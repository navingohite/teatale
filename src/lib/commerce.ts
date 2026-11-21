import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { packInclude, selectedPack, cartKey } from "./packs";
import { hash, secret, testMode, signature } from "./security";
export const cartSchema = z
  .array(
    z.object({
      id: z.string(),
      variantId: z.string().min(1).optional(),
      quantity: z.number().int().min(1).max(20),
      price: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(30)
  .refine(
    (a) => new Set(a.map(cartKey)).size === a.length,
    "Duplicate cart items",
  );
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().max(200),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  line1: z.string().trim().min(5).max(250),
  line2: z.string().max(250).default(""),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pin: z.string().regex(/^[1-9]\d{5}$/),
});
export const checkoutSchema = z.object({
  items: cartSchema,
  address: addressSchema,
  method: z.enum(["COD", "PREPAID", "TEST"]),
  key: z.string().uuid(),
  expectedTotal: z.number().int().positive(),
});
export async function quote(
  items: z.infer<typeof cartSchema>,
  pin: string,
  tx: Prisma.TransactionClient = db,
) {
  const settings = await tx.settings.findUniqueOrThrow({
    where: { id: "store" },
  });
  if (!/^[1-9]\d{5}$/.test(pin) || !settings.pins.split(/[\s,]+/).includes(pin))
    throw Error("This PIN code is not currently serviceable.");
  const products = await tx.product.findMany({
    where: { id: { in: items.map((i) => i.id) } },
    include: packInclude,
  });
  const lines = items.map((i) => {
    const product = products.find((p) => p.id === i.id);
    const p = product ? selectedPack(product, i.variantId) : null;
    if (
      !p ||
      !p.published ||
      p.archived ||
      p.status !== "AVAILABLE" ||
      !p.price ||
      !p.weight ||
      p.stock === null
    )
      throw Error("A tea in your cart is unavailable.");
    if (p.stock < i.quantity) throw Error(`Insufficient stock for ${p.name}.`);
    if (p.price !== i.price)
      throw Error(
        `The price of ${p.name} has changed. Refresh your cart before continuing.`,
      );
    return {
      productId: p.id,
      variantId: i.variantId ?? null,
      name: p.name,
      sku: i.variantId ? `${p.sku}-${p.weight}G` : p.sku,
      weight: p.weight,
      price: p.price,
      quantity: i.quantity,
    };
  });
  const subtotal = lines.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping =
    settings.freeAbove !== null && subtotal >= settings.freeAbove
      ? 0
      : settings.fee;
  return {
    lines,
    subtotal,
    shipping,
    total: subtotal + shipping,
    methods: [
      ...(settings.cod ? ["COD"] : []),
      ...(settings.prepaid &&
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET
        ? ["PREPAID"]
        : []),
      ...(testMode() ? ["TEST"] : []),
    ],
    estimate: settings.estimate,
  };
}
export async function adjustStock(
  tx: Prisma.TransactionClient,
  item: { productId: string; variantId?: string | null; weight?: number },
  delta: number,
) {
  const variantId =
    item.variantId ||
    (item.weight
      ? (
          await tx.productVariant.findUnique({
            where: {
              productId_weight: {
                productId: item.productId,
                weight: item.weight,
              },
            },
          })
        )?.id
      : undefined);
  if (variantId) {
    await tx.productVariant.update({
      where: { id: variantId },
      data: { stock: { increment: delta } },
    });
  } else {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: delta } },
    });
  }
}
export async function expireReservations() {
  await db.$transaction(async (tx) => {
    const expired = await tx.$queryRaw<
      { id: string }[]
    >`SELECT "id" FROM "Order" WHERE "payment"='PENDING' AND "expiresAt"<${new Date()} FOR UPDATE SKIP LOCKED`;
    for (const { id } of expired) {
      const o = await tx.order.update({
        where: { id },
        data: { payment: "EXPIRED", fulfilment: "CANCELLED" },
        include: { items: true },
      });
      for (const i of o.items) await adjustStock(tx, i, i.quantity);
      await tx.audit.create({
        data: {
          actor: "reservation-worker",
          action: "RESERVATION_EXPIRED",
          target: id,
          details: {
            released: o.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          },
        },
      });
    }
  });
}
export async function createOrder(input: z.infer<typeof checkoutSchema>) {
  await expireReservations();
  const digest = hash(JSON.stringify(input));
  const existing = await db.order.findUnique({
    where: { idempotency: input.key },
  });
  if (existing) {
    if (existing.requestHash !== digest)
      throw Error("Checkout has changed. Start a new attempt.");
    return {
      id: existing.id,
      token: signature(existing.idempotency, process.env.BETTER_AUTH_SECRET!),
      reused: true,
    };
  }
  const token = signature(input.key, process.env.BETTER_AUTH_SECRET!);
  try {
    return await db.$transaction(async (tx) => {
      // Lock products in a stable order to serialize stock deductions.
      for (const id of input.items.map((i) => i.id).sort())
        await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id"=${id} FOR UPDATE`;
      const repeated = await tx.order.findUnique({
        where: { idempotency: input.key },
      });
      if (repeated) {
        if (repeated.requestHash !== digest)
          throw Error("Checkout has changed. Start a new attempt.");
        return { id: repeated.id, token, reused: true };
      }
      const q = await quote(input.items, input.address.pin, tx);
      if (q.total !== input.expectedTotal)
        throw Error("Your total has changed. Review delivery charges again.");
      if (!q.methods.includes(input.method))
        throw Error("This payment method is unavailable.");
      for (const item of q.lines) await adjustStock(tx, item, -item.quantity);
      const o = await tx.order.create({
        data: {
          number: `TT-${secret().slice(0, 10).toUpperCase()}`,
          idempotency: input.key,
          requestHash: digest,
          tokenHash: hash(token),
          name: input.address.name,
          email: input.address.email.toLowerCase(),
          phone: input.address.phone,
          address: input.address,
          subtotal: q.subtotal,
          shipping: q.shipping,
          total: q.total,
          method: input.method,
          payment: input.method === "COD" ? "COD_DUE" : "PENDING",
          expiresAt:
            input.method === "COD"
              ? null
              : new Date(Date.now() + 30 * 60 * 1000),
          items: { create: q.lines },
        },
      });
      if (input.method === "COD")
        await tx.outbox.create({
          data: { orderId: o.id, kind: "confirmation", payload: { token } },
        });
      await tx.audit.create({
        data: {
          actor: "guest",
          action: "ORDER_CREATED",
          target: o.id,
          details: { method: input.method, total: q.total },
        },
      });
      return { id: o.id, token, reused: false };
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      const o = await db.order.findUnique({
        where: { idempotency: input.key },
      });
      if (o && o.requestHash === digest)
        return {
          id: o.id,
          token: signature(o.idempotency, process.env.BETTER_AUTH_SECRET!),
          reused: true,
        };
    }
    throw e;
  }
}
export async function provider(path: string, body?: unknown, method?: string) {
  const id = process.env.RAZORPAY_KEY_ID,
    key = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !key) throw Error("Prepaid payments are not configured.");
  if (process.env.ALLOW_LIVE_PAYMENTS !== "true" && !id.startsWith("rzp_test_"))
    throw Error("Live payments are disabled.");
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${key}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw Error("Payment provider request failed. Please retry.");
  return r.json();
}
export async function preparePayment(id: string) {
  await expireReservations();
  // Hold the row lock so simultaneous retries share one provider order.
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
      const o = await tx.order.findUniqueOrThrow({ where: { id } });
      if (o.payment !== "PENDING")
        throw Error("This payment attempt is no longer pending.");
      if (o.providerOrder) return o.providerOrder;
      const p = await provider("orders", {
        amount: o.total,
        currency: "INR",
        receipt: o.number,
      });
      await tx.order.update({ where: { id }, data: { providerOrder: p.id } });
      return p.id;
    },
    { timeout: 20000 },
  );
}
export async function completePayment(
  id: string,
  paymentId: string,
  token?: string,
) {
  await expireReservations();
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${id} FOR UPDATE`;
    const o = await tx.order.findUniqueOrThrow({ where: { id } });
    if (o.payment === "PAID") return;
    if (o.payment !== "PENDING")
      throw Error(
        "Payment arrived after expiry; manual reconciliation is required.",
      );
    const linkToken =
      token || signature(o.idempotency, process.env.BETTER_AUTH_SECRET!);
    await tx.order.update({
      where: { id },
      data: {
        payment: "PAID",
        providerPayment: paymentId,
        expiresAt: null,
        ...(!token ? { tokenHash: hash(linkToken) } : {}),
      },
    });
    await tx.outbox.upsert({
      where: { orderId_kind: { orderId: id, kind: "confirmation" } },
      create: {
        orderId: id,
        kind: "confirmation",
        payload: { token: linkToken },
      },
      update: {},
    });
    await tx.audit.create({
      data: {
        actor: "payment-provider",
        action: "PAYMENT_CAPTURED",
        target: id,
        details: { paymentId },
      },
    });
  });
}
export async function verifyProviderPayment(
  id: string,
  paymentId: string,
  token?: string,
) {
  const o = await db.order.findUniqueOrThrow({ where: { id } });
  const p = await provider(`payments/${encodeURIComponent(paymentId)}`);
  if (
    p.order_id !== o.providerOrder ||
    p.amount !== o.total ||
    p.currency !== "INR" ||
    p.status !== "captured"
  )
    throw Error("Payment is not yet captured or does not match this order.");
  await completePayment(id, paymentId, token);
}

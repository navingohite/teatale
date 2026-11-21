import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, audit } from "@/lib/admin";
import { sameOrigin } from "@/lib/security";
import { saveProduct, changeProductState } from "@/lib/products";
import { provider, adjustStock } from "@/lib/commerce";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  try {
    const admin = await requireAdmin();
    sameOrigin(req);
    const { section } = await params;
    const b = await req.json();
    if (section === "products") {
      const product = b.action
        ? await changeProductState(b, admin.id)
        : await saveProduct(b, admin.id);
      return NextResponse.json({ ok: true, product });
    } else if (section === "content") {
      const d = z
        .object({
          key: z.string(),
          title: z.string().min(1),
          body: z.string(),
          image: z
            .string()
            .regex(/^\/teas\/[a-zA-Z0-9_.-]+\.(webp|png|jpg|jpeg)$/)
            .nullable()
            .or(z.literal(""))
            .transform((v) => v || null),
          approved: z.boolean(),
        })
        .parse(b);
      await db.content.update({ where: { key: d.key }, data: d });
      await audit(admin.id, "CONTENT_SAVED", d.key, { approved: d.approved });
    } else if (["shipping", "payments", "settings"].includes(section)) {
      const schemas = {
        shipping: z.object({
          pins: z.string().refine(
            (s) =>
              s === "" ||
              s
                .split(/[\s,]+/)
                .filter(Boolean)
                .every((p) => /^[1-9]\d{5}$/.test(p)),
            "Use comma-separated six-digit PIN codes",
          ),
          fee: z.number().int().min(0),
          freeAbove: z.number().int().positive().nullable(),
          estimate: z.string().max(300),
        }),
        payments: z.object({ cod: z.boolean(), prepaid: z.boolean() }),
        settings: z.object({
          name: z.string().min(1),
          email: z.email(),
          instagram: z.string().regex(/^[a-zA-Z0-9_.]+$/),
          featured: z.string(),
        }),
      };
      const data = schemas[section as keyof typeof schemas].parse(b);
      if (
        "prepaid" in data &&
        data.prepaid &&
        (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
      )
        throw Error("Configure Razorpay server credentials first.");
      await db.settings.update({ where: { id: "store" }, data });
      await audit(admin.id, "SETTINGS_SAVED", section, data);
    } else if (section === "orders") {
      const input = z
        .object({
          id: z.string(),
          action: z.enum(["ship", "deliver", "cancel", "refund", "cod-paid"]),
          courier: z.string().max(100).optional(),
          tracking: z.string().max(200).optional(),
          trackingUrl: z
            .union([
              z.literal(""),
              z.url().refine((s) => s.startsWith("https://")),
            ])
            .optional(),
        })
        .parse(b);
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id"=${input.id} FOR UPDATE`;
          const o = await tx.order.findUniqueOrThrow({
            where: { id: input.id },
            include: { items: true },
          });
          if (input.action === "ship") {
            if (
              !["PAID", "COD_DUE"].includes(o.payment) ||
              o.fulfilment !== "NEW" ||
              o.refundId ||
              !input.courier ||
              !input.tracking
            )
              throw Error(
                "Only confirmed new orders with courier details can ship.",
              );
            await tx.order.update({
              where: { id: o.id },
              data: {
                fulfilment: "SHIPPED",
                courier: input.courier,
                tracking: input.tracking,
                trackingUrl: input.trackingUrl,
              },
            });
          }
          if (input.action === "deliver") {
            if (o.fulfilment !== "SHIPPED")
              throw Error("Ship the order first.");
            await tx.order.update({
              where: { id: o.id },
              data: { fulfilment: "DELIVERED" },
            });
          }
          if (input.action === "cod-paid") {
            if (
              o.method !== "COD" ||
              o.payment !== "COD_DUE" ||
              o.fulfilment !== "DELIVERED"
            )
              throw Error("Only delivered COD orders can be marked collected.");
            await tx.order.update({
              where: { id: o.id },
              data: { payment: "PAID" },
            });
          }
          if (input.action === "cancel") {
            if (o.fulfilment !== "NEW" || o.payment === "PAID")
              throw Error(
                "Only unshipped unpaid orders can be cancelled; refund prepaid orders first.",
              );
            await tx.order.update({
              where: { id: o.id },
              data: {
                fulfilment: "CANCELLED",
                payment: "CANCELLED",
                expiresAt: null,
              },
            });
            for (const i of o.items) await adjustStock(tx, i, i.quantity);
          }
          if (input.action === "refund") {
            if (
              !["PAID", "REFUND_PENDING"].includes(o.payment) ||
              o.method !== "PREPAID" ||
              o.fulfilment !== "NEW" ||
              !o.providerPayment
            )
              throw Error(
                "Only unshipped captured prepaid orders are eligible for an automated refund.",
              );
            let refundId = o.refundId;
            if (!refundId) {
              const list = await provider(
                `payments/${o.providerPayment}/refunds`,
              );
              const existing = list.items?.find(
                (r: { amount: number; status: string }) =>
                  r.amount === o.total && r.status !== "failed",
              );
              const r =
                existing ||
                (await provider(`payments/${o.providerPayment}/refund`, {
                  amount: o.total,
                  receipt: o.number,
                }));
              refundId = r.id;
              await tx.order.update({
                where: { id: o.id },
                data: { refundId, payment: "REFUND_PENDING" },
              });
            }
            const r = await provider(`refunds/${refundId}`);
            if (r.status === "failed") {
              await tx.order.update({
                where: { id: o.id },
                data: { payment: "PAID", refundId: null },
              });
            }
            if (
              r.status === "processed" &&
              r.amount === o.total &&
              r.payment_id === o.providerPayment
            ) {
              await tx.order.update({
                where: { id: o.id },
                data: { payment: "REFUNDED", fulfilment: "CANCELLED" },
              });
              for (const i of o.items) await adjustStock(tx, i, i.quantity);
            }
          }
          await tx.audit.create({
            data: {
              actor: admin.id,
              action: input.action.toUpperCase(),
              target: o.id,
              details: input,
            },
          });
        },
        { timeout: 25000 },
      );
    } else throw Error("Unknown section");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
        ? "A product with this URL slug or SKU already exists. Please use a unique value."
        : e instanceof z.ZodError
          ? e.issues
              .map((i) => `${i.path.join(".") || "Product"}: ${i.message}`)
              .join("\n")
          : e instanceof Error
            ? e.message
            : "Request failed";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}

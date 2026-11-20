import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import {
  cartSchema,
  checkoutSchema,
  quote,
  createOrder,
  preparePayment,
  verifyProviderPayment,
  completePayment,
  expireReservations,
} from "@/lib/commerce";
import {
  hash,
  secret,
  rate,
  sameOrigin,
  signature,
  equal,
  testMode,
} from "@/lib/security";
import { sendMail, flushMail } from "@/lib/mail";
export const dynamic = "force-dynamic";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    sameOrigin(req);
    const { action } = await params;
    const b = await req.json();
    if (action === "quote") {
      const q = await quote(cartSchema.parse(b.items), String(b.pin));
      return NextResponse.json(q);
    }
    if (action === "checkout") {
      const data = checkoutSchema.parse(b);
      await rate("checkout:" + hash(data.address.email.toLowerCase()), 15);
      const result = await createOrder(data);
      await flushMail();
      return NextResponse.json(result);
    }
    if (action === "otp-request") {
      const email = String(b.email).toLowerCase(),
        number = String(b.number);
      await rate("otp:" + hash(email), 5);
      await rate("order-otp:" + hash(number), 5);
      const o = await db.order.findFirst({ where: { number, email } });
      if (o) {
        const code = String(randomInt(100000, 1000000));
        await db.otp.upsert({
          where: { id: hash(number + email) },
          create: {
            id: hash(number + email),
            orderId: o.id,
            hash: hash(code),
            expiresAt: new Date(Date.now() + 600000),
          },
          update: {
            hash: hash(code),
            expiresAt: new Date(Date.now() + 600000),
            attempts: 0,
          },
        });
        try {
          await sendMail(
            email,
            "Your Tea Tale verification code",
            `Your code is ${code}. It expires in 10 minutes.`,
          );
        } catch {
          console.error(
            "Tracking email delivery failed. Check server email configuration.",
          );
        }
      }
      return NextResponse.json({
        message:
          "If those details match an order, a verification code has been sent.",
      });
    }
    if (action === "otp-verify") {
      const email = String(b.email).toLowerCase(),
        number = String(b.number);
      await rate("verify:" + hash(number + email), 8);
      const id = hash(number + email);
      const token = secret();
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Otp" WHERE "id"=${id} FOR UPDATE`;
        const otp = await tx.otp.findUnique({ where: { id } });
        if (!otp || otp.expiresAt < new Date() || otp.attempts >= 5)
          throw Error("Invalid or expired verification code.");
        await tx.otp.update({
          where: { id },
          data: { attempts: { increment: 1 } },
        });
        if (!equal(otp.hash, hash(String(b.code)))) return;
        await tx.order.update({
          where: { id: otp.orderId },
          data: { tokenHash: hash(token) },
        });
        await tx.otp.delete({ where: { id } });
      });
      const o = await db.order.findUnique({
        where: { tokenHash: hash(token) },
      });
      if (!o) throw Error("Invalid or expired verification code.");
      return NextResponse.json({ token });
    }
    const token = String(b.token || "");
    if (token.length !== 64) throw Error("Private tracking link required.");
    const o = await db.order.findUnique({
      where: { tokenHash: hash(token) },
      include: { items: true },
    });
    if (!o)
      throw Error("Order not found. Verify your email to get a new link.");
    if (action === "order") {
      await expireReservations();
      const fresh = await db.order.findUniqueOrThrow({
        where: { id: o.id },
        include: { items: true },
      });
      return NextResponse.json({
        number: fresh.number,
        items: fresh.items.map((i) => ({
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          weight: i.weight,
        })),
        total: fresh.total,
        shipping: fresh.shipping,
        payment: fresh.payment,
        fulfilment: fresh.fulfilment,
        method: fresh.method,
        courier: fresh.courier,
        tracking: fresh.tracking,
        trackingUrl: fresh.trackingUrl,
      });
    }
    if (action === "payment") {
      const providerOrder = await preparePayment(o.id);
      return NextResponse.json({
        providerOrder,
        key: process.env.RAZORPAY_KEY_ID,
        total: o.total,
      });
    }
    if (action === "verify-payment") {
      if (
        b.orderId !== o.providerOrder ||
        !equal(
          signature(
            `${o.providerOrder}|${b.paymentId}`,
            process.env.RAZORPAY_KEY_SECRET || "",
          ),
          String(b.signature),
        )
      )
        throw Error("Invalid payment signature.");
      await verifyProviderPayment(o.id, String(b.paymentId), token);
      await flushMail();
      return NextResponse.json({ ok: true });
    }
    if (action === "test-payment") {
      if (!testMode() || o.method !== "TEST")
        throw Error("Local test payments are disabled.");
      await completePayment(o.id, "test_" + o.id, token);
      await flushMail();
      return NextResponse.json({ ok: true });
    }
    throw Error("Unknown action");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 400 },
    );
  }
}

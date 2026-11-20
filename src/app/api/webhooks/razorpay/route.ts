import { NextResponse } from "next/server";
import { signature, equal } from "@/lib/security";
import { verifyProviderPayment } from "@/lib/commerce";
import { db } from "@/lib/db";
import { flushMail } from "@/lib/mail";
export async function POST(req: Request) {
  const body = await req.text();
  const key = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (
    !key ||
    !equal(signature(body, key), req.headers.get("x-razorpay-signature") || "")
  )
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  try {
    const e = JSON.parse(body);
    if (e.event === "payment.captured") {
      const p = e.payload.payment.entity;
      const o = await db.order.findUnique({
        where: { providerOrder: p.order_id },
      });
      if (!o) throw Error("Unknown order");
      await verifyProviderPayment(o.id, p.id);
      await flushMail();
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Reconciliation required; retry event" },
      { status: 409 },
    );
  }
}

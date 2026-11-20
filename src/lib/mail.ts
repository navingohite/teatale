import nodemailer from "nodemailer";
import { db } from "./db";
import { testMode } from "./security";
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  id?: string,
) {
  if (!process.env.SMTP_URL) {
    if (testMode()) {
      await import("node:fs/promises").then(async (fs) => {
        await fs.mkdir(".local/mail", { recursive: true });
        await fs.writeFile(
          `.local/mail/${id || Date.now()}.json`,
          JSON.stringify({ to, subject, text }),
        );
      });
      return;
    }
    throw Error("Email delivery is not configured.");
  }
  await nodemailer
    .createTransport(process.env.SMTP_URL)
    .sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      text,
      messageId: id ? `<${id}@teatale.local>` : undefined,
    });
}
export async function flushMail() {
  const jobs = await db.outbox.findMany({
    where: {
      sentAt: null,
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(Date.now() - 300000) } },
      ],
    },
    include: { order: true },
    take: 20,
  });
  for (const job of jobs) {
    const claimed = await db.outbox.updateMany({
      where: {
        id: job.id,
        sentAt: null,
        OR: [
          { lockedAt: null },
          { lockedAt: { lt: new Date(Date.now() - 300000) } },
        ],
      },
      data: { lockedAt: new Date() },
    });
    if (!claimed.count) continue;
    try {
      const payload = job.payload as { token: string };
      await sendMail(
        job.order.email,
        `Tea Tale order ${job.order.number}`,
        `Thank you, ${job.order.name}. Your order total is INR ${(job.order.total / 100).toFixed(2)}. Payment: ${job.order.payment}. Track privately: ${process.env.BETTER_AUTH_URL}/track-order?token=${payload.token}`,
        job.id,
      );
      await db.outbox.update({
        where: { id: job.id },
        data: { sentAt: new Date(), lockedAt: null },
      });
    } catch {
      await db.outbox.update({
        where: { id: job.id },
        data: { lockedAt: null },
      });
    }
  }
}

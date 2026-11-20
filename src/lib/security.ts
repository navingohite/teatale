import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const secret = () => randomBytes(32).toString("hex");
export function equal(a: string, b: string) {
  return (
    a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export function signature(body: string, key: string) {
  return createHmac("sha256", key).update(body).digest("hex");
}
export async function rate(key: string, max = 10, seconds = 900) {
  const now = new Date();
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO "RateLimit" ("key","count","expiresAt") VALUES (${key},1,${new Date(+now + seconds * 1000)}) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "RateLimit"."expiresAt"<${now} THEN 1 ELSE "RateLimit"."count"+1 END,"expiresAt"=CASE WHEN "RateLimit"."expiresAt"<${now} THEN ${new Date(+now + seconds * 1000)} ELSE "RateLimit"."expiresAt" END RETURNING "count"`;
  if (rows[0].count > max)
    throw Error("Too many attempts. Please try again later.");
}
export function sameOrigin(req: Request) {
  if (
    req.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3010").origin
  )
    throw Error("Invalid request origin.");
}
export const testMode = () =>
  process.env.LOCAL_TEST_MODE === "true" &&
  process.env.NODE_ENV !== "production" &&
  new URL(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3010").hostname ===
    "127.0.0.1";

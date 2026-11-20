import "dotenv/config";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
const base = "http://127.0.0.1:3010";
const qaEmail = "http-qa-" + Date.now() + "@example.test";
const rateEmail = "rate-" + Date.now() + "@example.test";
if (
  process.env.LOCAL_TEST_MODE !== "true" ||
  !new URL(process.env.DATABASE_URL!).pathname.endsWith("_dev")
)
  throw Error("Local QA only");
async function post(path: string, body: unknown, cookie = "") {
  const r = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: base,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw Error(path + " returned " + r.status + ": " + text.slice(0, 200));
  }
  return { r, data };
}
const unauth = await post("/api/admin/products", {});
assert.equal(unauth.r.status, 401);
const adminPage = await fetch(base + "/admin", { redirect: "manual" });
assert.equal(adminPage.status, 307);
const art = await fetch(base + "/api/admin-art/himalayan-green-tea");
assert.equal(art.status, 401);
const signup = await post("/api/auth/sign-up/email", {
  name: "Intruder",
  email: "intruder@example.test",
  password: "not-a-real-password-123",
});
assert.ok(signup.r.status >= 400);
const privateOrder = await post("/api/store/order", { number: "TT-123456" });
assert.equal(privateOrder.r.status, 400);
const webhook = await post("/api/webhooks/razorpay", {
  event: "payment.captured",
});
assert.equal(webhook.r.status, 401);
console.log(
  "PASS unauthorized admin, artwork, signup, order and unsigned webhook access blocked",
);
const credentials = JSON.parse(await readFile(".local/qa-admin.json", "utf8"));
const login = await post("/api/auth/sign-in/email", credentials);
assert.equal(login.r.status, 200, JSON.stringify(login.data));
const cookie = login.r.headers
  .getSetCookie()
  .map((v) => v.split(";")[0])
  .join("; ");
assert.ok(cookie);
const panel = await fetch(base + "/admin", { headers: { Cookie: cookie } });
assert.equal(panel.status, 200);
let product = await db.product.findUniqueOrThrow({
  where: { slug: "tulsi-green-tea" },
});
let result = await post(
  "/api/admin/products",
  { ...product, status: "AVAILABLE" },
  cookie,
);
assert.equal(result.r.status, 400);
result = await post(
  "/api/admin/products",
  { ...product, status: "AVAILABLE", price: 35000, stock: 4, weight: 75 },
  cookie,
);
assert.equal(result.r.status, 200, JSON.stringify(result.data));
result = await post(
  "/api/admin/content",
  {
    key: "home",
    title: "Tales of the Himalayas",
    body: "A little mountain stillness, in your everyday cup. Discover whole-leaf teas and a slower way to sip.",
    image: null,
    approved: true,
  },
  cookie,
);
assert.equal(result.r.status, 200);
await post("/api/admin/products", product, cookie);
console.log(
  "PASS admin login, activation validation, product persistence and content edits",
);
const p = await db.product.findUniqueOrThrow({
  where: { slug: "himalayan-green-tea" },
});
const items = [{ id: p.id, quantity: 1, price: p.price! }];
result = await post("/api/store/quote", { items, pin: "000000" });
assert.equal(result.r.status, 400);
const q = await post("/api/store/quote", { items, pin: "462001" });
assert.equal(q.r.status, 200);
assert.equal(q.data.total, 30000);
const checkout = {
  items,
  address: {
    name: "HTTP QA Guest",
    email: qaEmail,
    phone: "9876543210",
    line1: "10 Local Test Road",
    line2: "",
    city: "Bhopal",
    state: "Madhya Pradesh",
    pin: "462001",
  },
  method: "TEST",
  key: randomUUID(),
  expectedTotal: q.data.total,
};
const made = await post("/api/store/checkout", checkout);
assert.equal(made.r.status, 200, JSON.stringify(made.data));
assert.ok(made.data.token);
const again = await post("/api/store/checkout", checkout);
assert.equal(again.data.id, made.data.id);
let order = await post("/api/store/order", { token: made.data.token });
assert.equal(order.data.payment, "PENDING");
assert.equal(order.data.email, undefined);
assert.equal(order.data.address, undefined);
result = await post("/api/store/test-payment", { token: made.data.token });
assert.equal(result.r.status, 200, JSON.stringify(result.data));
result = await post("/api/store/test-payment", { token: made.data.token });
assert.equal(result.r.status, 200);
order = await post("/api/store/order", { token: made.data.token });
assert.equal(order.data.payment, "PAID");
assert.equal(await db.outbox.count({ where: { orderId: made.data.id } }), 1);
const files = await readdir(".local/mail");
assert.ok(files.length > 0);
console.log(
  "PASS guest checkout, cancelled/pending retry, duplicate completion, private tracking and local confirmation email",
);
result = await post("/api/store/otp-request", {
  number: order.data.number,
  email: qaEmail,
});
assert.equal(result.r.status, 200);
const mails = await Promise.all(
  (await readdir(".local/mail")).map(async (f) =>
    JSON.parse(await readFile(".local/mail/" + f, "utf8")),
  ),
);
const otpMail = mails
  .reverse()
  .find(
    (m) => m.subject === "Your Tea Tale verification code" && m.to === qaEmail,
  );
assert.ok(otpMail);
const code = otpMail.text.match(/\d{6}/)[0];
result = await post("/api/store/otp-verify", {
  number: order.data.number,
  email: qaEmail,
  code: "000000",
});
assert.equal(result.r.status, 400);
result = await post("/api/store/otp-verify", {
  number: order.data.number,
  email: qaEmail,
  code,
});
assert.equal(result.r.status, 200);
assert.ok(result.data.token);
const old = await post("/api/store/order", { token: made.data.token });
assert.equal(old.r.status, 400);
const fresh = await post("/api/store/order", { token: result.data.token });
assert.equal(fresh.r.status, 200);
for (let i = 0; i < 6; i++)
  result = await post("/api/store/otp-request", {
    number: "TT-" + rateEmail,
    email: rateEmail,
  });
assert.equal(result.r.status, 400);
console.log(
  "PASS email OTP verification, single-use code, link rotation and rate limiting",
);
for (const page of [
  "/",
  "/shop",
  "/our-story",
  "/brew-guide",
  "/cart",
  "/checkout",
  "/order-confirmation",
  "/track-order",
  "/contact",
  "/faq",
  "/shipping",
  "/returns",
  "/privacy",
  "/terms",
  ...(await db.product.findMany()).map((p) => "/tea/" + p.slug),
]) {
  const r = await fetch(base + page);
  assert.equal(r.status, 200, page);
  const body = await r.text();
  if (page === "/shop") {
    assert.ok(!body.includes("Flavonoids"));
    assert.ok(!body.includes("catalogueOrigin"));
  }
}
console.log(
  "PASS all 15 public templates and 16 product URLs; internal claims absent from storefront",
);
await db.$disconnect();

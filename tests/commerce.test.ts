import { execFileSync } from "node:child_process";
import "dotenv/config";
import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
if (
  !process.env.TEST_DATABASE_URL ||
  !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith("_test")
)
  throw Error(
    "TEST_DATABASE_URL must point at a dedicated database ending in _test",
  );
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.LOCAL_TEST_MODE = "true";
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3010";
const { db } = await import("../src/lib/db");
const { catalogue, initialContent } = await import("../src/lib/catalogue");
const {
  quote,
  cartSchema,
  createOrder,
  completePayment,
  expireReservations,
  checkoutSchema,
} = await import("../src/lib/commerce");
const { hash } = await import("../src/lib/security");
const { productSchema } = await import("../src/lib/admin");
const address = {
  name: "Test Guest",
  email: "guest@example.test",
  phone: "9876543210",
  line1: "10 Test Road",
  line2: "",
  city: "Bhopal",
  state: "Madhya Pradesh",
  pin: "462001",
};
let productId: string;
before(async () => {
  await db.outbox.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.content.deleteMany();
  await db.settings.deleteMany();
  await db.audit.deleteMany();
  for (const p of catalogue) await db.product.create({ data: p });
  for (const c of initialContent) await db.content.create({ data: c });
  await db.settings.create({
    data: {
      id: "store",
      pins: "462001",
      fee: 5000,
      freeAbove: 100000,
      cod: true,
    },
  });
  productId = (
    await db.product.findUniqueOrThrow({
      where: { slug: "himalayan-green-tea" },
    })
  ).id;
});
after(async () => {
  await db.$disconnect();
});
const input = (quantity = 1, method: "COD" | "TEST" = "COD") => ({
  items: [{ id: productId, quantity, price: 25000 }],
  address,
  method,
  key: randomUUID(),
  expectedTotal: 25000 * quantity + (quantity >= 4 ? 0 : 5000),
});
test("catalogue preserves exact range and unset production values", async () => {
  assert.equal(catalogue.length, 16);
  assert.equal(catalogue.filter((p) => p.status === "AVAILABLE").length, 2);
  assert.equal(catalogue.filter((p) => p.status === "COMING_SOON").length, 14);
  assert.ok(catalogue.every((p) => p.price === null && p.stock === null));
  assert.equal(new Set(catalogue.map((p) => p.slug)).size, 16);
  assert.ok(
    catalogue.slice(2).every((p) => p.weight === null && p.bestBefore === null),
  );
  await assert.rejects(() => quote(input().items, address.pin), /unavailable/);
});
test("server validation rejects invalid quantities, unsupported PINs, price changes and unavailable teas", async () => {
  await db.product.update({
    where: { id: productId },
    data: { price: 25000, stock: 10 },
  });
  assert.equal(
    cartSchema.safeParse([{ id: productId, quantity: 0, price: 25000 }])
      .success,
    false,
  );
  assert.equal(
    cartSchema.safeParse([{ id: productId, quantity: 1.2, price: 25000 }])
      .success,
    false,
  );
  assert.equal(
    checkoutSchema.safeParse({
      ...input(),
      address: { ...address, phone: "123" },
    }).success,
    false,
  );
  await assert.rejects(() => quote(input().items, "110001"), /serviceable/);
  await assert.rejects(
    () => quote([{ id: productId, quantity: 1, price: 100 }], address.pin),
    /price.*changed/,
  );
  await assert.rejects(
    () => quote([{ id: productId, quantity: 11, price: 25000 }], address.pin),
    /Insufficient/,
  );
  const upcoming = await db.product.findFirstOrThrow({
    where: { status: "COMING_SOON" },
  });
  await assert.rejects(
    () => quote([{ id: upcoming.id, quantity: 1, price: 25000 }], address.pin),
    /unavailable/,
  );
});
test("COD creates one order, one stock effect and one mail job across retries", async () => {
  const data = input();
  const a = await createOrder(data),
    b = await createOrder(data);
  assert.equal(a.id, b.id);
  assert.equal(a.token, b.token);
  const order = await db.order.findUniqueOrThrow({
    where: { id: a.id },
    include: { items: true },
  });
  assert.equal(order.payment, "COD_DUE");
  assert.equal(order.total, 30000);
  assert.equal(order.items[0].price, 25000);
  assert.equal(order.tokenHash, hash(a.token!));
  assert.equal(await db.outbox.count({ where: { orderId: a.id } }), 1);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    9,
  );
  await assert.rejects(
    () => createOrder({ ...data, expectedTotal: 1 }),
    /changed/,
  );
});
test("concurrent buyers cannot oversell the last pack", async () => {
  await db.product.update({ where: { id: productId }, data: { stock: 1 } });
  const results = await Promise.allSettled([
    createOrder(input()),
    createOrder(input()),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    0,
  );
});
test("changed shipping total is rejected without stock effects", async () => {
  await db.product.update({ where: { id: productId }, data: { stock: 5 } });
  await assert.rejects(
    () => createOrder({ ...input(), expectedTotal: 25000 }),
    /total has changed/,
  );
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    5,
  );
});
test("retry and duplicate payment events have one effect", async () => {
  const d = input(1, "TEST");
  const a = await createOrder(d);
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: a.id } })).payment,
    "PENDING",
  );
  const b = await createOrder(d);
  assert.equal(a.id, b.id);
  await Promise.all([
    completePayment(a.id, "test_" + a.id, a.token),
    completePayment(a.id, "test_" + a.id, a.token),
  ]);
  assert.equal(
    (await db.order.findUniqueOrThrow({ where: { id: a.id } })).payment,
    "PAID",
  );
  assert.equal(await db.outbox.count({ where: { orderId: a.id } }), 1);
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    4,
  );
});
test("abandoned reservations release once and reject late payment", async () => {
  const a = await createOrder(input(1, "TEST"));
  await db.order.update({
    where: { id: a.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await expireReservations();
  await expireReservations();
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    4,
  );
  await assert.rejects(() => completePayment(a.id, "late"), /expiry/);
});
test("historical order items survive product edits and upcoming activation validates commercial fields", async () => {
  const order = await db.order.findFirstOrThrow({ include: { items: true } });
  await db.product.update({
    where: { id: productId },
    data: { name: "Edited by admin", price: 35000 },
  });
  assert.equal(
    (await db.orderItem.findUniqueOrThrow({ where: { id: order.items[0].id } }))
      .name,
    "Himalayan Green Tea",
  );
  const upcoming = await db.product.findFirstOrThrow({
    where: { status: "COMING_SOON" },
  });
  assert.equal(
    productSchema.safeParse({ ...upcoming, status: "AVAILABLE" }).success,
    false,
  );
  assert.equal(
    productSchema.safeParse({
      ...upcoming,
      status: "AVAILABLE",
      price: 45000,
      stock: 7,
      weight: 75,
    }).success,
    true,
  );
});

test("repeat seed preserves owner edits including slug and SKU without duplicates", async () => {
  await db.product.update({
    where: { id: productId },
    data: { slug: "owner-custom-slug", sku: "OWNER-SKU", price: 35100 },
  });
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"],
    {
      env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
      stdio: "pipe",
    },
  );
  assert.equal(await db.product.count(), 16);
  const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
  assert.equal(p.slug, "owner-custom-slug");
  assert.equal(p.sku, "OWNER-SKU");
  assert.equal(p.price, 35100);
});

test("publication lifecycle gates buying and deletion preserves order history", async () => {
  const { saveProduct, changeProductState } =
    await import("../src/lib/products");
  const { id: _id, ...base } = catalogue[0];
  const draft = await saveProduct(
    {
      ...base,
      slug: "publication-test-tea",
      sku: "QA-PUBLISH",
      name: "Publication test tea",
      status: "AVAILABLE",
      published: false,
      price: 19900,
      stock: 4,
    },
    "test-admin",
  );
  const lines = [{ id: draft.id, quantity: 1, price: 19900 }];
  await assert.rejects(() => quote(lines, address.pin), /unavailable/);
  await changeProductState({ id: draft.id, action: "publish" }, "test-admin");
  assert.equal((await quote(lines, address.pin)).total, 24900);
  const order = await createOrder({
    items: lines,
    address,
    method: "COD",
    key: randomUUID(),
    expectedTotal: 24900,
  });
  await changeProductState({ id: draft.id, action: "unpublish" }, "test-admin");
  await assert.rejects(() => quote(lines, address.pin), /unavailable/);
  await changeProductState({ id: draft.id, action: "delete" }, "test-admin");
  assert.equal(
    (
      await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      })
    ).items[0].name,
    "Publication test tea",
  );
  assert.equal(
    (await db.product.findUniqueOrThrow({ where: { id: draft.id } })).archived,
    true,
  );
  await assert.rejects(
    () => changeProductState({ id: draft.id, action: "publish" }, "test-admin"),
    /Restore/,
  );
  await changeProductState({ id: draft.id, action: "restore" }, "test-admin");
  const restored = await db.product.findUniqueOrThrow({
    where: { id: draft.id },
  });
  assert.equal(restored.published, false);
  assert.equal(restored.archived, false);
  await saveProduct(
    {
      ...restored,
      status: "COMING_SOON",
      price: null,
      stock: null,
      weight: null,
      published: true,
    },
    "test-admin",
  );
  await assert.rejects(() => quote(lines, address.pin), /unavailable/);
  await assert.rejects(
    () =>
      saveProduct(
        { ...restored, status: "AVAILABLE", price: null, published: true },
        "test-admin",
      ),
    /price/,
  );
});

test("MRP validation and discounts preserve the selling price used at checkout", async () => {
  const { discountPercent } = await import("../src/lib/format");
  const { saveProduct } = await import("../src/lib/products");
  const { id: _id, ...base } = catalogue[0];
  const input = {
    ...base,
    slug: "mrp-test",
    sku: "QA-MRP",
    price: 19900,
    mrp: 24900,
    stock: 10,
    published: true,
  };
  assert.equal(
    productSchema.safeParse({ ...input, mrp: 19800 }).success,
    false,
  );
  assert.equal(productSchema.safeParse({ ...input, mrp: 0 }).success, false);
  assert.equal(discountPercent(19900, 24900), 20);
  assert.equal(discountPercent(19900, 19900), 0);
  assert.equal(discountPercent(19900, null), 0);
  const p = await saveProduct(input, "test-admin");
  assert.equal(p.mrp, 24900);
  const q = await quote([{ id: p.id, quantity: 1, price: 19900 }], "462001");
  assert.equal(q.subtotal, 19900);
  const cleared = await saveProduct(
    { ...p, variants: undefined, mrp: null },
    "test-admin",
  );
  assert.equal(cleared.mrp, null);
});

test("pack sizes have independent prices, stock, cart identity and historical order snapshots", async () => {
  const { saveProduct } = await import("../src/lib/products");
  const { packInclude } = await import("../src/lib/packs");
  const { id: _id, ...base } = catalogue[0];
  const variants = [
    { weight: 500, price: 49900, mrp: 59900, stock: 3 },
    { weight: 1000, price: 89900, mrp: 99900, stock: 1 },
    { weight: 2000, price: 169900, mrp: 189900, stock: 0 },
  ];
  const body = {
    ...base,
    slug: "pack-test",
    sku: "QA-PACK",
    variants,
    price: null,
    mrp: null,
    stock: null,
    weight: null,
  };
  assert.equal(
    productSchema.safeParse({ ...body, variants: [variants[0], variants[0]] })
      .success,
    false,
  );
  assert.equal(
    productSchema.safeParse({
      ...body,
      variants: [{ ...variants[0], mrp: 100 }],
    }).success,
    false,
  );
  const p = await saveProduct(body, "test-admin");
  const [small, large, empty] = p.variants;
  const lines = [
    { id: p.id, variantId: small.id, quantity: 1, price: small.price! },
    { id: p.id, variantId: large.id, quantity: 1, price: large.price! },
  ];
  assert.equal(cartSchema.safeParse(lines).success, true);
  assert.equal(cartSchema.safeParse([lines[0], lines[0]]).success, false);
  await assert.rejects(
    () => quote([{ ...lines[0], variantId: undefined }], address.pin),
    /unavailable/,
  );
  await assert.rejects(
    () => quote([{ ...lines[0], id: productId }], address.pin),
    /unavailable/,
  );
  await assert.rejects(
    () => quote([{ ...lines[0], price: 19900 }], address.pin),
    /changed/,
  );
  await assert.rejects(
    () =>
      quote(
        [{ ...lines[0], variantId: empty.id, price: empty.price! }],
        address.pin,
      ),
    /stock/,
  );
  const q = await quote(lines, address.pin);
  assert.equal(q.subtotal, 139800);
  assert.deepEqual(
    q.lines.map((i) => i.weight),
    [500, 1000],
  );
  const attempt = () =>
    createOrder({
      items: [lines[1]],
      address,
      method: "COD",
      key: randomUUID(),
      expectedTotal: 94900,
    });
  const results = await Promise.allSettled([attempt(), attempt()]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: large.id } }))
      .stock,
    0,
  );
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: small.id } }))
      .stock,
    3,
  );
  const reservation = await createOrder({
    items: [lines[0]],
    address,
    method: "TEST",
    key: randomUUID(),
    expectedTotal: 54900,
  });
  assert.equal(
    (await db.productVariant.findUniqueOrThrow({ where: { id: small.id } }))
      .stock,
    2,
  );
  await saveProduct(
    { ...body, id: p.id, variants: [{ ...large, stock: 0 }] },
    "test-admin",
  );
  await assert.rejects(() => quote([lines[0]], address.pin), /unavailable/);
  await db.order.update({
    where: { id: reservation.id },
    data: { expiresAt: new Date(0) },
  });
  await expireReservations();
  await expireReservations();
  const released = await db.productVariant.findUniqueOrThrow({
    where: { id: small.id },
  });
  assert.equal(released.stock, 3);
  assert.equal(released.archived, true);
  const historical = await db.orderItem.findFirstOrThrow({
    where: { orderId: reservation.id },
  });
  assert.equal(historical.variantId, small.id);
  assert.equal(historical.weight, 500);
  assert.equal(historical.price, 49900);
  const fresh = await db.product.findUniqueOrThrow({
    where: { id: p.id },
    include: packInclude,
  });
  assert.equal(fresh.variants.filter((v) => !v.archived).length, 1);
  await assert.rejects(
    () =>
      saveProduct(
        { ...body, id: p.id, variants: [{ ...large, id: small.id }] },
        "test-admin",
      ),
    /weight changed/,
  );
});

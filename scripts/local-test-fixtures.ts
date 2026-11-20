import "dotenv/config";
import { db } from "../src/lib/db";
import { testMode } from "../src/lib/security";
if (
  !testMode() ||
  !new URL(process.env.DATABASE_URL!).pathname.endsWith("_dev")
)
  throw Error(
    "Fixtures require loopback LOCAL_TEST_MODE and a dedicated _dev database.",
  );
await db.product.updateMany({
  where: { slug: { in: ["himalayan-green-tea", "himalayan-black-tea"] } },
  data: { price: 25000, stock: 20 },
});
await db.settings.update({
  where: { id: "store" },
  data: { pins: "462001,462016", fee: 5000, freeAbove: 100000, cod: true },
});
console.log(
  "LOCAL TEST ONLY: ₹250 packs, 20 each, PINs 462001/462016, ₹50 delivery, free at ₹1000. Never use these values in production.",
);
await db.$disconnect();

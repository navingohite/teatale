import "dotenv/config";
import { db } from "../src/lib/db";
import { catalogue, initialContent } from "../src/lib/catalogue";
for (const p of catalogue)
  await db.product.upsert({ where: { id: p.id }, create: p, update: {} });
for (const c of initialContent)
  await db.content.upsert({ where: { key: c.key }, create: c, update: {} });
await db.settings.upsert({
  where: { id: "store" },
  create: { id: "store" },
  update: {},
});
console.log("Catalogue seeded without overwriting existing edits.");
await db.$disconnect();

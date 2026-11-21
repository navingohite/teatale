CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productId" TEXT NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "weight" INTEGER NOT NULL CHECK ("weight" > 0),
  "price" INTEGER CHECK ("price" > 0),
  "mrp" INTEGER CHECK ("mrp" > 0),
  "stock" INTEGER CHECK ("stock" >= 0),
  "archived" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ProductVariant_mrp_valid" CHECK ("mrp" IS NULL OR "price" IS NULL OR "mrp" >= "price")
);
CREATE UNIQUE INDEX "ProductVariant_productId_weight_key" ON "ProductVariant"("productId", "weight");
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;
INSERT INTO "ProductVariant" ("id", "productId", "weight", "price", "mrp", "stock")
SELECT 'pack-' || "id", "id", "weight", "price", "mrp", "stock" FROM "Product" WHERE "weight" IS NOT NULL;
UPDATE "OrderItem" AS i SET "variantId" = v."id" FROM "ProductVariant" AS v
WHERE i."productId" = v."productId" AND i."weight" = v."weight";

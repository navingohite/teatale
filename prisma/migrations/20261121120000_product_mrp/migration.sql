ALTER TABLE "Product" ADD COLUMN "mrp" INTEGER;
ALTER TABLE "Product" ADD CONSTRAINT "Product_mrp_valid" CHECK ("mrp" IS NULL OR ("mrp" > 0 AND ("price" IS NULL OR "mrp" >= "price")));

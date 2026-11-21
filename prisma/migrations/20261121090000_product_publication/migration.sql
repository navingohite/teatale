ALTER TABLE "Product" ADD COLUMN "published" BOOLEAN NOT NULL DEFAULT false;
-- Preserve the visibility of the existing catalogue; new products start private.
UPDATE "Product" SET "published" = true WHERE "status" <> 'DRAFT' AND "archived" = false;

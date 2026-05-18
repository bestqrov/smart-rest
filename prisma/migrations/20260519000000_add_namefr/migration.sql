-- Add French name field to Category and Product tables
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "nameFr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "nameFr" TEXT NOT NULL DEFAULT '';

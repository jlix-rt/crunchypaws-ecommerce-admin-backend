-- Soft delete support: add deleted_at columns

ALTER TABLE IF EXISTS "Category"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS "Product"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ NULL;


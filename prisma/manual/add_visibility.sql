-- Agrega visibilidad a tablas usadas por Prisma (sin reset).
-- Postgres: tablas con nombre sensible a mayúsculas van entre comillas.

ALTER TABLE IF EXISTS "Category"
  ADD COLUMN IF NOT EXISTS "is_visible" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE IF EXISTS "Product"
  ADD COLUMN IF NOT EXISTS "is_visible" BOOLEAN NOT NULL DEFAULT TRUE;


-- CreateEnum (safe)
DO $$ BEGIN CREATE TYPE "ProductType" AS ENUM ('PRODUCT', 'SERVICE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'REVERSAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ProductCategory
CREATE TABLE IF NOT EXISTS "product_categories" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL, "description" TEXT, "color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_categories_workspace_id_name_key" ON "product_categories"("workspace_id", "name");
DO $$ BEGIN ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Product
CREATE TABLE IF NOT EXISTS "products" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "category_id" TEXT,
    "name" TEXT NOT NULL, "sku" TEXT NOT NULL, "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'PRODUCT',
    "unit_price" DECIMAL(12,5) NOT NULL DEFAULT 0,
    "cost_price" DECIMAL(12,5),
    "current_stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "unit_of_measure" TEXT,
    "track_inventory" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "products_workspace_id_sku_key" ON "products"("workspace_id", "sku");
CREATE INDEX IF NOT EXISTS "products_workspace_id_is_active_idx" ON "products"("workspace_id", "is_active");
CREATE INDEX IF NOT EXISTS "products_workspace_id_current_stock_idx" ON "products"("workspace_id", "current_stock");
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- StockMovement
CREATE TABLE IF NOT EXISTS "stock_movements" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "product_id" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "previous_stock" INTEGER NOT NULL,
    "new_stock" INTEGER NOT NULL,
    "reason" TEXT,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_movements_workspace_id_idx" ON "stock_movements"("workspace_id");
CREATE INDEX IF NOT EXISTS "stock_movements_product_id_idx" ON "stock_movements"("product_id");
CREATE INDEX IF NOT EXISTS "stock_movements_workspace_id_created_at_idx" ON "stock_movements"("workspace_id", "created_at" DESC);
DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add product_id to invoice_lines
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "product_id" TEXT;
CREATE INDEX IF NOT EXISTS "invoice_lines_product_id_idx" ON "invoice_lines"("product_id");
DO $$ BEGIN ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

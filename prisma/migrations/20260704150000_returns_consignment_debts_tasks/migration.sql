-- AlterTable
ALTER TABLE "consignment_inventory" ADD COLUMN     "defective_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "linked_sale_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "price_tiers" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "returned_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT NOT NULL,
ADD COLUMN     "sold_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "debts" ADD COLUMN     "debt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "loss_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "archived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "area" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "consignment_inventory_organization_id_sku_key" ON "consignment_inventory"("organization_id", "sku");


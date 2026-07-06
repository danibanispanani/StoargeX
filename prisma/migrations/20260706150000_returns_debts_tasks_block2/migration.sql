-- CreateEnum
CREATE TYPE "DebtKind" AS ENUM ('KAUF', 'VERKAUF', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "DebtEntry" AS ENUM ('IO', 'FEHLT');

-- AlterEnum
ALTER TYPE "DebtStatus" ADD VALUE 'OTHER';

-- AlterEnum
ALTER TYPE "OptionKind" ADD VALUE 'TASK_AREA';

-- AlterEnum
ALTER TYPE "ReturnStatus" ADD VALUE 'CONFLICT';

-- AlterTable
ALTER TABLE "debts" ADD COLUMN     "entry_status" "DebtEntry" NOT NULL DEFAULT 'IO',
ADD COLUMN     "kind" "DebtKind" NOT NULL DEFAULT 'SONSTIGES',
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "ref_id" TEXT;


-- Datenmigration: bestehende Auto-Schulden aus dem Wareneinkauf als KAUF markieren
UPDATE "debts" SET "kind" = 'KAUF', "debtor_name" = 'GbR'
WHERE "description" LIKE 'Auslage Wareneinkauf%';

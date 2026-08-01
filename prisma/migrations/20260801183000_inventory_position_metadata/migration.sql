-- Add editable, non-booking metadata to movement-based inventory positions.
ALTER TABLE "inventory_positions"
ADD COLUMN "location" TEXT,
ADD COLUMN "notes" TEXT;

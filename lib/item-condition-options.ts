import type { ItemCondition } from "@prisma/client";

export const ITEM_CONDITION_OPTIONS: ReadonlyArray<{
  value: ItemCondition;
  label: string;
}> = [
  { value: "NEW", label: "Neu" },
  { value: "OPEN_BOX", label: "Geöffnet" },
  { value: "REFURBISHED", label: "Generalüberholt" },
  { value: "USED", label: "Gebraucht" },
  { value: "DEFECTIVE", label: "Defekt" },
];

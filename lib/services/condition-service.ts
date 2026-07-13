export type ItemCondition = "NEW" | "OPEN_BOX" | "REFURBISHED" | "USED" | "DEFECTIVE";

const CONDITION_ALIASES: Readonly<Record<string, ItemCondition>> = {
  new: "NEW",
  neu: "NEW",
  neuware: "NEW",
  sealed: "NEW",
  ungeoffnet: "NEW",
  ungeoeffnet: "NEW",
  openbox: "OPEN_BOX",
  geoffnet: "OPEN_BOX",
  geoeffnet: "OPEN_BOX",
  bware: "OPEN_BOX",
  refurbished: "REFURBISHED",
  refurb: "REFURBISHED",
  generaluberholt: "REFURBISHED",
  generalueberholt: "REFURBISHED",
  used: "USED",
  gebraucht: "USED",
  defective: "DEFECTIVE",
  defect: "DEFECTIVE",
  defekt: "DEFECTIVE",
  beschadigt: "DEFECTIVE",
  beschaedigt: "DEFECTIVE",
};

function normalizeLegacyCondition(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function mapLegacyCondition(value: string | null | undefined): ItemCondition | null {
  if (!value?.trim()) return null;
  return CONDITION_ALIASES[normalizeLegacyCondition(value)] ?? null;
}

export function resolveItemCondition(input: {
  itemCondition?: ItemCondition | null;
  legacyCondition?: string | null;
}): ItemCondition | null {
  return input.itemCondition ?? mapLegacyCondition(input.legacyCondition);
}

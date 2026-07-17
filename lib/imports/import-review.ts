export const IMPORT_REVIEW_STATUSES = [
  "CONFLICT",
  "ERROR",
  "REVIEW_REQUIRED",
  "UNRESOLVED",
] as const;

export function importTargetHref(
  targetEntity: string,
  legacyReference: string | null
) {
  const query = legacyReference?.trim()
    ? `?q=${encodeURIComponent(legacyReference.trim())}`
    : "";
  if (["PRODUCT"].includes(targetEntity)) return `/produkte${query}`;
  if (["PURCHASE", "PURCHASE_LINE", "PURCHASE_RECEIPT"].includes(targetEntity)) {
    return `/einkauf${query}`;
  }
  if (targetEntity === "INVENTORY_POSITION") return `/lager${query}`;
  if (targetEntity === "CONSIGNMENT_LOT") return `/konsignation${query}`;
  if (["SALE", "SALE_LINE", "SALE_LINE_ALLOCATION"].includes(targetEntity)) {
    return `/verkauf${query}`;
  }
  if (["RETURN", "RETURN_LINE"].includes(targetEntity)) {
    return `/retouren/kunden${query}`;
  }
  if (["SUPPLIER_RETURN", "SUPPLIER_RETURN_LINE"].includes(targetEntity)) {
    return `/retouren/lieferanten${query}`;
  }
  if (targetEntity === "DEBT") return `/schulden${query}`;
  if (targetEntity === "TASK") return `/aufgaben${query}`;
  if (targetEntity === "EXPENSE") return `/finanzen/ausgaben${query}`;
  return "/einstellungen";
}

export function importTargetLabel(targetEntity: string) {
  return targetEntity
    .toLowerCase()
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

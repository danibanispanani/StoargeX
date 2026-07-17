import type { TenantDb } from "@/lib/tenant-db";
import type { ExportDatasetKey, PortableRow } from "@/lib/data-portability/catalog";
import { sanitizePortableData } from "@/lib/data-portability/catalog";

function date(value: Date | null | undefined): string {
  return value?.toISOString() ?? "";
}

function decimal(value: { toString(): string } | null | undefined): string {
  return value?.toString() ?? "";
}

export async function loadExportDataset(
  db: TenantDb,
  dataset: ExportDatasetKey
): Promise<PortableRow[]> {
  let rows: PortableRow[];

  switch (dataset) {
    case "inventory-ledger": {
      const movements = await db.inventoryMovement.findMany({
        include: {
          inventoryPosition: {
            include: { product: { select: { name: true, ean: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = movements.map((movement) => ({
        "Bewegungs-ID": movement.id,
        LagerID: movement.inventoryPosition.inventoryNumber,
        Artikel: movement.inventoryPosition.product.name,
        EAN: movement.inventoryPosition.product.ean ?? "",
        Bestandsart: movement.inventoryPosition.inventoryType,
        Bewegung: movement.movementType,
        Menge: movement.quantity,
        Von: movement.fromBucket ?? "",
        Nach: movement.toBucket ?? "",
        Referenztyp: movement.referenceType ?? "",
        "Referenz-ID": movement.referenceId ?? "",
        Referenzaktion: movement.referenceAction ?? "",
        Kommentar: movement.comment ?? "",
        Gebucht_am: date(movement.createdAt),
      }));
      break;
    }
    case "purchases": {
      const purchases = await db.purchase.findMany({
        include: {
          businessPartner: { select: { displayName: true } },
          paymentAccount: { select: { displayName: true } },
          lines: { include: { product: { select: { name: true, variant: true, ean: true } } } },
        },
        orderBy: { purchaseDate: "asc" },
      });
      rows = purchases.flatMap((purchase) =>
        purchase.lines.map((line) => ({
          Einkaufsnummer: purchase.purchaseNumber,
          Lieferanten_Bestellnummer: purchase.supplierOrderNumber ?? "",
          Bestelldatum: date(purchase.purchaseDate),
          Lieferant: purchase.businessPartner?.displayName ?? purchase.vendor,
          Artikel: line.product.name,
          Variante: line.product.variant ?? "",
          EAN: line.product.ean ?? "",
          Menge: line.quantity,
          Stückpreis_brutto: decimal(line.unitPriceGross),
          Stückpreis_netto: decimal(line.unitPriceNet),
          Gesamt_brutto: decimal(line.totalGross),
          Gesamt_netto: decimal(line.totalNet),
          Vorsteuer: line.vatDeductible,
          Zahlungskonto: purchase.paymentAccount?.displayName ?? purchase.paymentMethod,
          Bestellstatus: purchase.purchaseStatus,
          Versandstatus: purchase.shippingStatus,
          Erwartet_am: date(purchase.expectedDeliveryAt),
          Eingegangen_am: date(purchase.receivedAt),
          Rückgabefrist: date(purchase.returnDeadline),
        }))
      );
      break;
    }
    case "sale-lines": {
      const lines = await db.saleLine.findMany({
        include: {
          sale: {
            include: {
              platform: { select: { name: true } },
              marketplaceAccount: { select: { displayName: true } },
            },
          },
          product: { select: { name: true, ean: true } },
          allocations: {
            include: {
              inventoryPosition: { select: { inventoryNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = lines.flatMap((line) => {
        const allocations = line.allocations.length ? line.allocations : [null];
        return allocations.map((allocation) => ({
          Verkaufsnummer: line.sale.orderNumber ?? line.sale.id,
          Verkaufsdatum: date(line.sale.soldAt),
          Plattform: line.sale.platform.name,
          Marktplatzkonto: line.sale.marketplaceAccount?.displayName ?? "",
          Artikel: line.descriptionSnapshot || line.product.name,
          EAN: line.product.ean ?? "",
          Positionsmenge: line.quantity,
          Stückpreis_brutto: decimal(line.unitGrossPrice),
          Betrag_brutto: decimal(line.grossAmount),
          Betrag_netto: decimal(line.netAmount),
          LagerID: allocation?.inventoryPosition.inventoryNumber ?? "",
          Allokationsmenge: allocation?.quantity ?? "",
          EK_netto_Snapshot: decimal(allocation?.unitCostNetSnapshot),
          Bestandsart_Snapshot: allocation?.inventoryTypeSnapshot ?? "",
          Konsignationsabrechnung_Snapshot: decimal(allocation?.consignmentSettlementSnapshot),
        }));
      });
      break;
    }
    case "return-lines": {
      const lines = await db.returnLine.findMany({
        include: {
          return: { include: { sale: { select: { orderNumber: true } } } },
          saleLine: { select: { descriptionSnapshot: true } },
          returnAllocations: {
            include: {
              saleLineAllocation: {
                include: { inventoryPosition: { select: { inventoryNumber: true } } },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = lines.flatMap((line) => {
        const allocations = line.returnAllocations.length ? line.returnAllocations : [null];
        return allocations.map((allocation) => ({
          Retourennummer: line.return.returnNumber ?? line.return.id,
          Verkaufsnummer: line.return.sale.orderNumber ?? "",
          Meldedatum: date(line.return.requestedAt),
          Retourenstatus: line.return.status,
          Artikel: line.saleLine.descriptionSnapshot,
          Menge: line.quantity,
          Rückgabegrund: line.problemType ?? "",
          Zustand: line.itemCondition ?? line.condition ?? "",
          Erstattung: line.refundAmountCents ?? "",
          Zusatzkosten: line.extraCostsCents ?? "",
          LagerID: allocation?.saleLineAllocation.inventoryPosition.inventoryNumber ?? "",
          Allokationsmenge: allocation?.quantity ?? "",
          Eingangsbewegung: allocation?.receiptMovementId ?? "",
          Einlagerungsbewegung: allocation?.restockMovementId ?? "",
          Defektbewegung: allocation?.defectiveMovementId ?? "",
        }));
      });
      break;
    }
    case "supplier-returns": {
      const returns = await db.supplierReturn.findMany({
        include: {
          purchase: { select: { purchaseNumber: true } },
          supplier: { select: { displayName: true } },
          lines: {
            include: {
              purchaseLine: { include: { product: { select: { name: true, ean: true } } } },
              inventoryPosition: { select: { inventoryNumber: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = returns.flatMap((supplierReturn) =>
        supplierReturn.lines.map((line) => ({
          LR_Nummer: supplierReturn.returnNumber ?? supplierReturn.id,
          Einkaufsnummer: supplierReturn.purchase.purchaseNumber,
          Lieferant: supplierReturn.supplier?.displayName ?? supplierReturn.supplierSnapshot,
          Status: supplierReturn.status,
          LagerID: line.inventoryPosition.inventoryNumber,
          Artikel: line.purchaseLine.product.name,
          EAN: line.purchaseLine.product.ean ?? "",
          Menge: line.quantity,
          Bestands_Bucket: line.sourceBucket,
          Rückgabegrund: line.reason ?? "",
          Rückgabefrist: date(supplierReturn.returnDeadline),
          RMA: supplierReturn.rmaNumber ?? "",
          Trackingnummer: supplierReturn.trackingNumber ?? "",
          Versandkosten: supplierReturn.shippingCostCents,
          Erwartete_Erstattung: supplierReturn.expectedRefundCents,
          Tatsächliche_Erstattung: supplierReturn.actualRefundCents,
          Differenz: supplierReturn.actualRefundCents - supplierReturn.expectedRefundCents,
          Ausgangsbewegung: line.outboundMovementId ?? "",
        }))
      );
      break;
    }
    case "expenses": {
      const expenses = await db.expense.findMany({
        include: {
          category: { select: { name: true } },
          supplier: { select: { displayName: true } },
          paymentAccount: { select: { displayName: true } },
          marketplaceAccount: { select: { displayName: true } },
          recurrence: true,
        },
        orderBy: { incurredAt: "asc" },
      });
      rows = expenses.map((expense) => ({
        Bezeichnung: expense.description,
        Kategorie: expense.category?.name ?? "",
        Lieferant: expense.supplier?.displayName ?? "",
        Betrag_brutto: decimal(expense.amountGross),
        Betrag_netto: decimal(expense.amountNet),
        Steuer_Prozent: decimal(expense.taxRatePercent),
        Steuerbetrag: decimal(expense.taxAmount),
        Zahlungsdatum: date(expense.incurredAt),
        Fälligkeit: date(expense.dueAt),
        Bezahlt_am: date(expense.paidAt),
        Zahlungskonto: expense.paymentAccount?.displayName ?? "",
        Marktplatzkonto: expense.marketplaceAccount?.displayName ?? "",
        Status: expense.status,
        Beleg: expense.receiptReference ?? "",
        Intervall: expense.recurrence?.interval ?? "",
        Intervallanzahl: expense.recurrence?.intervalCount ?? "",
        Startdatum: date(expense.recurrence?.startsAt),
        Enddatum: date(expense.recurrence?.endsAt),
      }));
      break;
    }
    case "fee-rules": {
      const rules = await db.feeRule.findMany({
        include: {
          platform: { select: { name: true } },
          marketplaceAccount: { select: { displayName: true } },
          feeSchedule: { select: { name: true, version: true } },
          feeCategory: { select: { officialName: true, externalCategoryId: true } },
        },
        orderBy: [{ validFrom: "asc" }, { priority: "desc" }],
      });
      rows = rules.map((rule) => ({
        Plattform: rule.platform.name,
        Marktplatzkonto: rule.marketplaceAccount?.displayName ?? "",
        Gebührenset: rule.feeSchedule?.name ?? "",
        Version: rule.feeSchedule?.version ?? "",
        Kategorie: rule.feeCategory?.officialName ?? rule.category ?? "",
        Externe_Kategorie: rule.feeCategory?.externalCategoryId ?? "",
        Artikelzustand: rule.itemCondition ?? "",
        Gültig_ab: date(rule.validFrom),
        Gültig_bis: date(rule.validUntil),
        Prozent: decimal(rule.percentage),
        Fix: rule.fixedFeeCents,
        Minimum: rule.minimumFeeCents ?? "",
        Maximum: rule.maximumFeeCents ?? "",
        Werbegebühr_Prozent: decimal(rule.advertisingPercent),
        Zahlungsgebühr_Prozent: decimal(rule.paymentFeePercent),
        USt_Behandlung: rule.vatTreatment,
        Priorität: rule.priority,
        Herkunft: rule.origin,
        Quelle: rule.source ?? "",
        Aktiv: rule.active,
      }));
      break;
    }
    case "tasks": {
      const tasks = await db.task.findMany({
        include: {
          createdBy: { select: { email: true } },
          assignments: { include: { user: { select: { email: true } } } },
          checklistItems: { select: { completed: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = tasks.map((task) => ({
        Titel: task.title,
        Beschreibung: task.description ?? "",
        Bereich: task.area ?? "",
        Priorität: task.priority,
        Status: task.status,
        Frist: date(task.dueDate),
        Ersteller: task.createdBy.email,
        Umfang: task.scope,
        Bearbeiter: task.assignments.map((assignment) => assignment.user.email).join(", "),
        Primär_verantwortlich: task.assignments.find((assignment) => assignment.role === "PRIMARY")?.user.email ?? "",
        Checklistenpunkte: task.checklistItems.length,
        Checklistenpunkte_erledigt: task.checklistItems.filter((item) => item.completed).length,
        Archiviert: task.archived,
        Wiedervorlage: date(task.snoozedUntil),
      }));
      break;
    }
    case "platform-accounts": {
      const accounts = await db.marketplaceAccount.findMany({
        include: {
          platform: { select: { name: true } },
          defaultPayoutAccount: { select: { displayName: true } },
          defaultFeeSchedule: { select: { name: true, version: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      rows = accounts.map((account) => ({
        Plattform: account.platform.name,
        Anzeigename: account.displayName,
        Externe_Accountkennung: account.externalAccountId ?? "",
        Accounttyp: account.accountType,
        Marktplatzcode: account.marketplaceCode ?? "",
        Land: account.marketplaceCountry ?? "",
        Verkäuferprofil: account.sellerProfile ?? "",
        Shopmodell: account.shopModel ?? "",
        Steuerprofil: account.taxProfile ?? "",
        Standardzustand: account.standardCondition ?? "",
        Standard_Auszahlungskonto: account.defaultPayoutAccount?.displayName ?? "",
        Standard_Gebührenset: account.defaultFeeSchedule?.name ?? "",
        Gebührenset_Version: account.defaultFeeSchedule?.version ?? "",
        Aktiv: account.active,
      }));
      break;
    }
    case "entitlements": {
      const entitlements = await db.featureEntitlement.findMany({
        orderBy: { createdAt: "asc" },
      });
      rows = entitlements.map((entitlement) => ({
        Feature: entitlement.featureKey,
        Status: entitlement.status,
        Herkunft: entitlement.source,
        Start: date(entitlement.startsAt),
        Ende: date(entitlement.endsAt),
        Externe_Referenz: entitlement.externalRef ?? "",
        Erstellt_am: date(entitlement.createdAt),
        Aktualisiert_am: date(entitlement.updatedAt),
      }));
      break;
    }
  }

  return sanitizePortableData(rows);
}

export function filterPortableRows(rows: PortableRow[], query: string): PortableRow[] {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  if (!normalized) return rows;
  return rows.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? "").toLocaleLowerCase("de-DE").includes(normalized)
    )
  );
}

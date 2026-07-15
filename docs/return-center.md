# StorageX Return Center

## Scope and operating model

Prompt 6 splits returns into two independent operational modules. They share shell, table, import, document-number, audit, and inventory infrastructure, but they do not share a domain table or status machine.

| Area | Route | Document number | Authoritative relation |
|---|---|---|---|
| Customer returns | `/retouren/kunden` | existing `R-YY-NNNN` sequence | `Return -> ReturnLine -> ReturnAllocation -> SaleLineAllocation -> InventoryMovement` |
| Supplier returns | `/retouren/lieferanten` | independent `LR-YY-NNNN` sequence | `SupplierReturn -> SupplierReturnLine -> PurchaseLine / InventoryPosition -> InventoryMovement` |

`/retouren` redirects to the customer area. Navigation exposes both routes under one “Retouren” group. No screen combines customer and supplier rows.

## Customer returns

### Intake

The create workflow searches relational sales, displays the remaining returnable quantity for every `SaleLineAllocation`, and accepts only explicit allocation quantities. The customer return records:

- reported date and optional physical receipt date;
- reason/problem type and canonical `ItemCondition` with a legacy disposition label;
- refund, separate additional cost, and return-shipping cost;
- carrier, tracking number, notes, and optional evidence URLs.

Existing R numbers and legacy returns remain readable. Legacy returns without relational lines are not silently converted and cannot trigger automated inventory movements.

### Inspection and inventory decisions

Customer stock consequences remain in `returns-service.ts` and the inventory service:

1. `RECEIVE` creates one idempotent `RETURN_RECEIPT` per return allocation and moves the allocation quantity into `INSPECTION`.
2. `RESTOCK` creates a missing receipt when necessary, then creates `RETURN_RESTOCK` from `INSPECTION` to `AVAILABLE`.
3. `DEFECTIVE` creates a missing receipt when necessary, then creates `RETURN_DEFECTIVE` from `INSPECTION` to `DEFECTIVE`.

Movement IDs remain on `ReturnAllocation`. Deterministic idempotency keys prevent double booking. A status change that has a stock consequence is routed to this service and never implemented as a direct quantity update.

The operative statuses are `REQUESTED`, `INSPECTION`, `RESTOCKED`, `DEFECTIVE`, `REFUNDED`, `REJECTED`, `CONFLICT`, and `COMPLETED`. The legacy `RECEIVED` value remains compatible and can advance into inspection or a disposition.

### Financial meaning

`lossCents` continues to be calculated server-side with the existing return-loss calculation. It uses gross refund, sale tax rate, sale fees/shipping, plus both additional costs and return-shipping costs. The financial view never derives a second competing loss formula in the browser.

## Supplier returns

### Planning and relations

A supplier return is created against one existing purchase. Every line references:

- the original `PurchaseLine`;
- one concrete owned `InventoryPosition` / lot;
- one selected source bucket;
- a positive quantity;
- an optional canonical condition and legacy condition snapshot;
- a return reason;
- at most one outbound movement.

Several lots or buckets are represented by several supplier-return lines. This keeps cost, stock provenance, and idempotency explicit. Consignment positions are rejected because consignment returns are a separate partner workflow.

Planning creates an LR document in `DRAFT` and does not mutate stock. The operational path is:

`DRAFT -> REQUESTED -> APPROVED -> DISPATCHED -> ARRIVED -> REFUND_PENDING / PARTIALLY_REFUNDED / REFUNDED -> COMPLETED`

`REJECTED`, `CANCELLED`, replacement-pending, and the legacy credit-pending states remain explicit. The service rejects illegal transitions and terminal-state reopening.

### Dispatch invariant

Only the confirmed “Versenden & Bestand buchen” action removes stock. For each line the supplier-return service calls `returnOwnedStockToSupplier`, which applies:

- movement type `SUPPLIER_RETURN_OUT`;
- `fromBucket` equal to the line’s persisted source bucket;
- `toBucket = null`;
- required inventory type `OWNED`;
- an organization-scoped deterministic idempotency key;
- a `SupplierReturnLine` reference and audit entry.

The generic inventory service performs an atomic guarded decrement, movement creation, and audit write inside the same transaction. The supplier line stores the movement ID. Retrying a completed dispatch returns the existing result and cannot subtract the quantity twice.

Status and refund writes use the previously read status as an optimistic transaction guard. A concurrent change aborts with a refresh instruction instead of overwriting another valid transition. Customer creation with an optional physical receipt date performs creation, receipt movements, and inspection transition in one transaction.

### Deadline and refund semantics

The return deadline is persisted on the supplier-return header and is filterable/displayed as:

- overdue: deadline calendar day before today;
- due soon: today through seven calendar days;
- on track: more than seven days.

No deadline triggers an automatic shipment or return.

Expected and actual refunds are stored as non-negative cents. The displayed difference is `actual - expected`; a negative value is an outstanding shortfall. Refund state is derived deterministically:

- actual `0`: `REFUND_PENDING`;
- actual between `0` and expected: `PARTIALLY_REFUNDED`;
- actual at least expected, or a positive refund with no expected amount: `REFUNDED`.

Shipping cost, RMA/reference, credit reference, carrier, tracking, arrival/refund dates, notes, document URLs, and evidence URLs remain separate fields. Bound capital uses `quantity × original PurchaseLine.unitPriceNet` for each non-terminal line.

## Views

Customer-return views are `Standard`, `Prüfung`, `Finanzen`, `Erstattung`, and `Alle`. The standard projection keeps R number, sale, item/allocation, quantity, issue, loss, status, and actions visible. Details expose relations, dates, refund/cost split, notes, and evidence metadata.

Supplier-return views are `Standard`, `Rückgabefristen`, `Versand`, `Erstattung`, `Konflikte`, and `Alle`. The standard projection keeps LR number, purchase/supplier, product/lot/bucket, quantity, deadline, status, and next actions visible. Details expose purchase/lot relations, dispatch/arrival, RMA/tracking, original capital, shipping, expected/actual refund, notes, and movement provenance.

Table view choice remains locally persisted under independent keys. A dashboard `preset` takes precedence for that navigation so attention links open the intended projection. Besides their column projection, the specialized views filter their own relevant workflow rows; import/export controls and preferences remain independently scoped.

## Import and export

New toolbars use separate keys:

- `kundenretouren`: customer sale reference, dates, condition, refund/cost split, tracking, and notes;
- `lieferantenretouren`: purchase number, inventory number, bucket, quantity, reason, deadline, RMA, expected refund, shipping cost, and notes.

Both provide empty/example CSV/XLSX templates, column descriptions, mandatory-field markers, mapping preview, dry run, row errors/conflicts, and a reviewable commit through the existing `ImportBatch` / `SourceReference` pipeline. Supplier dry run resolves the purchase and lot within the active organization and verifies bucket capacity. A committed supplier row calls the supplier-return domain service and creates a `SUPPLIER_RETURN` source reference. Imports plan supplier returns; they never dispatch stock automatically.

The historical `retouren` import key is retained as a compatibility alias. It does not appear in either new route toolbar and is not repurposed for supplier data.

Exports are separate. Customer exports contain customer/refund/inspection metadata; supplier exports emit one row per supplier-return line with LR, purchase, supplier, lot, bucket, deadline, dispatch, refund, difference, and status.

## Dashboard insights

The dashboard exposes five independent return signals with calculation text and filtered next actions:

1. open customer returns: customer statuses that still need receipt, inspection, or resolution;
2. customer return loss: sum of stored server-calculated `lossCents` in the selected dashboard period;
3. supplier returns before deadline: non-terminal LR with a deadline no later than 14 days from today, including overdue items;
4. open supplier refunds: dispatched/arrived/refund-pending/partially-refunded/credit-pending LR;
5. capital in supplier returns: line quantity times original purchase-line unit net price for non-terminal LR.

## Tenant, role, audit, and compatibility guarantees

- All route actions call `requireOrg("MEMBER")`; reads use the tenant-scoped database facade.
- Services re-establish `app.current_org_id` for direct transactions and every lookup includes `organizationId`.
- Existing supplier-return tables retain FORCE RLS and tenant/bypass policies from the Prompt-1 migration. Prompt 6 adds columns and enum values only; it does not add a parallel tenant table.
- Creation, status transitions, imports, and inventory movements write audit/source provenance at their established seams.
- No column, legacy status, R number, supplier text snapshot, customer return, supplier return, lot, or movement is deleted by the migration.
- Optional documents/images are represented as URL/reference arrays; secret material remains outside these models.

## Verification contract

Automated coverage includes customer allocation/transition behavior, supplier partial quantities, source buckets, deadlines, refunds, rejection/terminal transitions, movement idempotency/no double booking, migration additivity, tenant mismatch rejection, separate template contracts, supplier import dry-run resolution/capacity, and navigation separation.

# Domain Generalization Decisions

## Status

These are binding target decisions for the beta rebuild. They do not authorize a schema migration or a replacement of existing core models.

| Concern | Decision | Existing foundation to extend | Compatibility rule |
|---|---|---|---|
| Platform vs. platform account | A platform is a sales channel; a platform account is a configurable organization-specific operating identity beneath it. Neither `eBay` nor variants such as `eBay R` are special code paths. | `Platform`, listings, sale platform reference, credentials | Preserve current platform names as historical labels and map incrementally; do not rewrite old sales. |
| Persons and counterparties | Use configurable party references with role-specific use (supplier, consignee, debtor, creditor, payout recipient). No named-person rule is allowed. | `Debt`, `SelectOption`, audit snapshots | Keep legacy names and free text readable; a free-text fallback remains valid for imports and exceptional cases. |
| Suppliers | Prefer a supplier reference with a controlled display name and optional source-specific free text. | `Purchase.vendor`, `OwnedStockLot.vendor`, import provenance | Existing vendor strings remain the document snapshot and migration source. |
| Payment accounts | Payment method/account is configurable organizational master data, never a test for a named account or person. | `SelectOption(PAYMENT_METHOD)`, purchase/lot payment fields | Preserve labels on historical purchases and imported rows. |
| Payout recipients | Use a configurable recipient reference, with a snapshot on the sale/settlement. | `SelectOption(PAYOUT_RECIPIENT)`, sale payout fields, debt relations | Do not infer recipient identity from a free-text label after posting. |
| Channel prices | Historical import fields (`vk_preis`, `vk_ki`, `preis_mm`, and equivalent) are source evidence only. Future price policy is per configurable platform/account, never hardcoded channel columns. | `SourceReference`, historical import data, `ConsignmentLot.channelPrices` | Display read-only in provenance; do not merge into editable product comments. |
| Owned inventory | The owned flow remains Purchase -> PurchaseLine -> OwnedStockLot -> InventoryPosition -> InventoryMovement. | Existing purchase, lot, position, movement services | Do not introduce a second stock counter or parallel lot table. |
| Consignment | Consignment is an `InventoryPosition(CONSIGNMENT)` with `ConsignmentLot`, settled through standard sale allocations; it is entitlement-gated, not domain-optional. | `ConsignmentLot`, sale allocations, movements, debts | Absence of entitlement removes operative entry points only; it never deletes or invalidates data. |
| Customer returns | A customer return is sale-originated and allocation-aware. Its table/workflow is distinct. | `Return`, `ReturnLine`, `ReturnAllocation`, returns service | Retain current legacy-compatible return records and historical status display. |
| Supplier returns | Supplier returns are purchase/owned-lot-originated, not customer returns with a different label. | Purchase/lot/movement/debt and audit foundations | Add only with an approved additive model and a separate migration; never overload customer-return fields. |
| Document identity | User-facing numbers remain generated only by `DocumentSequence`; references are immutable after posting. | Document-number service | Never derive IDs from platform, named people, or mutable configuration labels. |
| Import | Every target module receives template -> mapping/validation -> dry run -> row-level review -> commit. | `ImportBatch`, `SourceReference`, import migration service | Dry runs create no domain data; committed rows retain source references and errors/warnings. |

## Required future module seams

1. **Commercial-reference module:** Owns configurable party, supplier, platform/account, payment-account, and payout-recipient lookup/validation. It provides small stable interfaces to forms and domain services; document snapshots remain inside the posting implementation.
2. **Operational-read module:** Produces canonical list and detail projections for current core plus legacy rows during the transition. Pages consume projections rather than normalize competing models themselves.
3. **Table workspace module:** Owns table interaction behavior and persisted preferences; its callers retain domain-specific view definitions and actions.
4. **Dashboard insight module:** Turns reporting outputs into transparent attention, comparison, score, and next-action projections. It does not duplicate calculation rules.

These seams are planned because multiple adapters already vary. Existing inventory movement, sale allocation, return allocation, debt, document-number, and import services are deep modules today; rebuilding them would reduce locality and is out of scope.

# StorageX Internal Product Constitution

## Purpose and scope

StorageX is an operational trading console for teams that buy, hold, sell, return, consign, settle, and report goods. This constitution governs the protected SaaS application. It is intentionally different from the public site: public pages explain the product; internal screens help an operator make correct decisions quickly.

This is a product and delivery contract, not an implementation. It preserves the existing multi-tenant/RLS, document, inventory, sales, returns, debt, import, audit, and calculation foundations.

## Internal design language

The application may inherit the public **Transit Ledger** vocabulary: precise rails, ledger rows, status marks, quiet paper/ink surfaces, and the visible trace of a goods movement. It must not inherit the marketing composition, oversized statements, decorative scenes, or large animation sequences.

An internal screen is successful when an operator can answer, at a glance:

1. What needs attention now?
2. What is the current state and why?
3. What action is safe and permitted?
4. What will that action change?

Use dense but breathable tables, explicit labels, concise amount/date/ID formatting, clear state color semantics, and a responsive layout that preserves the primary work rather than shrinking it into ambiguity. Motion is limited to feedback and must respect reduced-motion preferences. Keyboard operation, visible focus, semantic controls, contrast, and non-color status cues are non-negotiable.

## Operational tables

Tables are primary workspaces, not passive lists. Every important table follows one coherent interaction model, applied only where the domain permits it:

- Search, filter, and bidirectional sort are URL/query-state aware so a working view is shareable and recoverable.
- Each module owns its views; a stock view is not a sales view. Default views answer the module's key operating question.
- Operators can select visible columns and reorder non-essential columns; the primary identity, state, and required action columns remain protected.
- Selection supports only safe bulk actions. Irreversible, financial, inventory, or entitlement-affecting changes require a preview, permission check, and domain-valid confirmation.
- Row actions distinguish edit, archive, cancel, reverse, and delete. Labels must describe the actual business consequence. Historical documents are cancelled/reversed, not silently deleted.
- A detail drawer exposes evidence, relations, movement/provenance timeline, audit context, and next valid actions without losing the working table state.
- Export preserves the approved external shape. Import is offered only where a module has a reviewed template, dry run, error review, and `ImportBatch`/`SourceReference` provenance.
- View, sort, filters, columns, density, and safe saved views are user preferences scoped to the organization and module; they never alter shared domain data.

The future common table module is a deep module at the table seam: callers supply a small module definition and projection; it owns persisted view state, query-state adaptation, selection, column behavior, bulk-action affordances, and drawer framing. Domain services remain responsible for actual mutations.

## Dashboard standard

The dashboard is a performance and attention console, not a card-and-chart gallery. It must use the existing reporting and calculation data as evidence and present:

- a short operational brief for the selected period;
- trends and comparison baselines with their selected period and denominator;
- warnings ranked by urgency, impact, and confidence;
- scores only when their formula, inputs, range, and limitations are visible;
- attention items that link to a pre-filtered operational view and state the next action;
- a compact recent-change/provenance trail for managers.

No score may be presented as a prediction or fact without its calculation. No chart is retained merely because it is available. The future dashboard insight module should own the policy for score, alert, comparison, and next-action projections while `lib/reporting.ts` remains its data adapter.

## Domain integrity and generalization

The following core stays authoritative and must be extended rather than duplicated: organization/RLS and roles; `DocumentSequence`; `Product`; `Purchase`/`PurchaseLine`; `InventoryPosition`, `OwnedStockLot`, `ConsignmentLot`, and `InventoryMovement`; `Sale`, `SaleLine`, `SaleLineAllocation`; `Return`, `ReturnLine`, `ReturnAllocation`; `Debt` and relational links; `ImportBatch`, `SourceReference`, `AuditLog`, and calculation functions.

Inventory is movement-based. Current quantities are consequences of accepted movements. UI code and generic bulk flows must never write current stock counters directly. All new stock effects route through the inventory service using the relevant movement type and idempotency/reference data.

Commercial references are configurable: platform and platform account; supplier with free-text fallback; person/party; payment account; payout recipient; carrier; tax rate. Documents keep immutable display snapshots so historical records remain understandable after master data changes. Imported historical channel-price fields remain read-only provenance, not editable master data.

Customer returns and supplier returns are separate modules. A customer return is anchored to a sale line/allocation and moves goods through receive/inspection/restock/defect choices. A supplier return is anchored to an owned purchase/lot and carries supplier, dispatch, credit/replacement, and outbound stock consequences. Shared return UI primitives and movement services are permitted; shared tables and ambiguous statuses are not.

Consignment remains in the core. An add-on entitlement controls navigation, create/edit actions, and advanced reports. When unavailable, its data is retained and auditable; dependent historic sales, returns, debts, imports, and reports remain readable according to role.

## Delivery gates

Any beta-rebuild change must identify its module interface, the existing seam it extends, authorization/RLS behavior, audit consequence, import/export compatibility, and the relevant table-view entry. Schema work requires a separately approved, additive migration plan; it is not authorized by this constitution.

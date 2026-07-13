# Beta Rebuild Roadmap

## Guardrails

This roadmap is implementation sequencing only. Prompt 0 delivers documentation and governance, not a schema migration, UI reconstruction, tariff change, or new domain feature. Every later phase preserves the existing multi-tenant/RLS, role, document number, product, inventory, allocation, return, debt, import, audit, and calculation foundations.

## Phase 0 — Constitution and evidence baseline (complete in this commit)

Deliver the internal product constitution, generalization decisions, table-view matrix, and navigation/entitlement map. Confirm the clean baseline, current schema/migrations, existing documentation, codebase architecture, and limited UI/tooling state.

Exit gate: documentation identifies existing seams and explicitly excludes parallel foundations, migration work, UI reconstruction, and tariff changes.

## Phase 1 — Operational-read and table-workspace design

Design before implementation the two shared UI seams: canonical list/detail projections spanning current and legacy records, and the common table workspace with query state, saved preferences, selectable columns, selection, drawers, and safe bulk affordances. Define module-specific table definitions from the matrix; do not force identical views across modules.

Exit gate: each target table has a projection contract, required default question, role/action matrix, drawer evidence, export/import scope, and test surface. No domain mutation logic moves into UI modules.

## Phase 2 — Navigation and entitlement enforcement

Implement the navigation hierarchy around operational flow and introduce a separate consignment capability check at route, projection, and server-action seams. Keep existing tier behavior unchanged until a separately authorized billing decision. Define the inactive-entitlement read/history behavior.

Exit gate: all listed protected routes enforce session, organization, role, and entitlement consistently; no consignment data is deleted or made historically incoherent.

## Phase 3 — Commercial-reference generalization

Introduce the approved configurable commercial-reference model in an additive, migration-reviewed change: platform/account, supplier, party, payment account, and payout recipient. Move named defaults and platform-specific conditions out of domain behavior. Retain free-text fallbacks and immutable posting snapshots.

Exit gate: no person/platform/account name is a business-rule branch; historical documents, imports, debt links, audit logs, and exports retain their original readable labels.

## Phase 4 — Read-model and operational-table rollout

Roll out the shared table workspace and canonical projections one operational module at a time: stock/purchases, products, sales, customer returns, consignment, debts, tasks, imports, shipping, credentials, team, and master data. Preserve current behavior first; add module-specific views only when they answer an identified operating question.

Exit gate: every migrated module satisfies its row in the table-view matrix, retains URL-restorable filters, has saved user preferences, and routes mutations through existing actions/services with audit and authorization checks.

## Phase 5 — Dashboard intelligence redesign

Build the dashboard insight module above existing reporting and calculation adapters. Replace generic metric display incrementally with transparent period comparisons, attention ranking, score formulas, evidence links, and pre-filtered next actions.

Exit gate: every dashboard element declares its period/data basis; every warning is actionable; no score hides a calculation; reporting calculations are not duplicated.

## Phase 6 — Separate return operations

Keep the existing sale-linked customer-return workflow intact while adding the separately designed supplier-return workflow. Share technical presentation primitives where useful, but use distinct tables, navigation, status vocabulary, authorization, financial outcomes, and stock movements. Any schema work is additive and separately reviewed.

Exit gate: customer returns always resolve through sale lines/allocations and the return service; supplier returns always originate from purchase/owned-lot context; each workflow has independent imports/exports and audit evidence.

## Phase 7 — Import coverage and provenance

For every newly importable module, deliver the template download, mapping/validation, dry run, row-level errors, review/commit step, and exported error report. Reuse `ImportBatch` and `SourceReference`; preserve legacy details read-only and make duplicate/conflict policy explicit.

Exit gate: dry runs cannot write domain rows; committed rows expose source provenance; templates round-trip with approved exports where required; failure states are recoverable and observable.

## Phase 8 — Verification, accessibility, and beta readiness

Verify each changed module through its module interface: RLS/role/entitlement tests, inventory/debt/document invariants, Vitest domain coverage, table preference/query-state tests, import dry-run/commit tests, accessibility and responsive browser checks, and integrity/export checks. Add beta instrumentation only through existing audit/provenance seams.

Exit gate: `npx tsc --noEmit`, targeted tests, `npm run integrity:check`, migration/Prisma checks for approved schema phases, affected browser/accessibility checks, and `git diff --check` pass. The beta release decision is recorded separately from this roadmap.

## Architecture priorities carried into the roadmap

The architecture audit ranks these opportunities: the operational table module, canonical current/legacy read projections, commercial-reference generalization, and dashboard insight policy. Existing inventory movement, document-number, transactional sale/return allocation, debt, and import modules are already deep modules; the roadmap extends their interfaces rather than replacing their implementations.

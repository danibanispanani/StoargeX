# StorageX Agent Instructions

## Project Context
- StorageX is a Next.js/React app with Prisma-backed inventory, sales, returns, consignment, debts, imports, and reporting.
- Treat inventory as a movement-based system. Do not directly overwrite stock counters such as `quantityAvailable` unless the existing local code explicitly does so for legacy records.
- For current inventory positions, stock changes must flow through `InventoryMovement` services such as `SALE_OUT`, `RETURN_*`, `ADJUSTMENT_IN`, and `ADJUSTMENT_OUT`.

## Working Rules
- Check `git status --short` before editing. The worktree may contain user changes; never revert unrelated changes.
- Keep changes scoped to the requested workflow. Avoid broad refactors unless they are required to fix the root cause.
- Prefer existing service/action patterns under `lib/actions/*` and `lib/services/*`.
- Use `apply_patch` for manual edits.
- Do not commit, branch, or reset unless the user explicitly asks.

## Validation
- For TypeScript or UI changes, run `npx tsc --noEmit` when practical.
- For focused domain changes, run the closest Vitest files first, for example `tests/*service*.test.ts`.
- If full `npm run lint` fails on unrelated existing files, report that and run targeted lint on changed files.

## Domain Notes
- Consignment sales happen through `/verkauf`; returns and defects happen through `/retouren`.
- Consignment UI should not expose direct sale, return, or defect buttons.
- Channel price fields from imports such as `vk_preis`, `vk_ki`, and `preis_mm` are historical noise unless a task explicitly reintroduces them.
- Historical CSV details may be displayed read-only, but should not be mixed into editable master-data comments.

## Internal SaaS Product Constitution
- Treat the protected application as an operational trading console, not as a marketing surface. It may reuse the public Transit Ledger brand vocabulary, but must not import landing-page storytelling, large decorative motion, or promotional layouts.
- Optimize for fast comprehension, high information density, consistent precision, accessibility, and responsive operation. Prefer stable hierarchy, meaningful status, visible provenance, and keyboard-safe interactions over visual novelty or generic AI-SaaS patterns.
- Tables are operational workspaces. For each important module, provide the common interaction contract where domain-appropriate: search, ascending/descending sorting, filters, module-specific views, column control, selection, safe bulk actions, detail inspection, export, import where it has a valid domain purpose, and persisted user preferences. The module's default view must answer its primary operational question without repeated context switching.
- A dashboard must be an operational intelligence surface, not a grid of generic KPI cards and charts. Every score, trend, comparison, warning, and recommendation must expose its calculation, period, data basis, and a concrete next action.
- Do not hardcode personal, account, platform, supplier, or payout special cases. Model configurable references and preserve historical labels/snapshots for documents and imports. Examples such as `eBay`, `eBay R`, named people, or a supplier string are data examples, never business rules.
- Keep customer returns and supplier returns as separate operational workflows and tables. Shared technical modules are allowed; do not collapse their statuses, responsibility, or stock/financial consequences into one UI workflow.
- Consignment is a domain-core capability. Gate discovery and use through a separate add-on entitlement; never delete, hide destructively, or rewrite consignment data when the entitlement is absent.
- Every newly importable module requires a downloadable template, mapping/validation, a non-writing dry run, row-level error reporting, and a reviewable commit step. Reuse `ImportBatch` and `SourceReference`; preserve historical source data read-only.
- Extend existing deep modules at their established seams: `requireOrg` for tenant/role access, `DocumentSequence` for document numbers, transactional domain services for inventory movements/allocation, calculation modules for money, `AuditLog` for traceability, and the import pipeline for provenance. Do not fork parallel foundations.

# StorageX Agent Instructions

## Project Context
- `StorageX` is the current repository and working name for a Next.js/React app with Prisma-backed inventory, sales, returns, consignment, debts, imports, and reporting. The final product name and logo are not decided; avoid spreading the working brand through domain logic or creating new permanent brand dependencies.
- Treat inventory as a movement-based system. Do not directly overwrite stock counters such as `quantityAvailable` unless the existing local code explicitly does so for legacy records.
- For current inventory positions, stock changes must flow through `InventoryMovement` services such as `SALE_OUT`, `RETURN_*`, `ADJUSTMENT_IN`, and `ADJUSTMENT_OUT`.

## Confirmed Product Scope and Open Decisions
- The product must stay generic for the usual legal forms. Do not hardcode GbR-only behavior, named people, or the current small test organization. A guided organization setup/onboarding is planned but not part of a task unless explicitly requested.
- Current records and test scenarios may be fictional. Do not present test data as real production usage or verified customer evidence.
- Existing legal texts are placeholders and are not legally approved. Preserve that status in documentation and UI unless the user supplies reviewed texts.
- The current rollout is local/small-group testing. Deployment follows only after the tabs have been corrected and individually verified; a free beta for user feedback is planned later. Never deploy merely because an implementation prompt is complete.
- Detailed payout-management behavior is still an open product question. Do not invent a payout workflow or encode it as a confirmed requirement without a separate decision.

## Working Rules
- Check `git status --short` before editing. The worktree may contain user changes; never revert unrelated changes.
- Keep changes scoped to the requested workflow. Avoid broad refactors unless they are required to fix the root cause.
- Prefer existing service/action patterns under `lib/actions/*` and `lib/services/*`.
- Use `apply_patch` for manual edits.
- Do not commit, branch, or reset unless the user explicitly asks.

## Approved Hybrid-SPA Performance Direction
- The approved target for the protected application is a hybrid SPA on the existing Next.js App Router stack. Keep Next.js 15, React 19, Prisma, Supabase, Auth.js, RLS, the existing app shell, and the established domain services; do not propose a framework rewrite unless new measured evidence invalidates this decision.
- Treat the existing `(app)` layout as the persistent shell. Operational tab changes must feel immediate: update navigation and controls synchronously, show cached module data immediately when available, and load or save authoritative data in the background.
- Use a client-side server-state cache for migrated operational modules. The approved foundation is TanStack Query. Do not introduce a second competing server-state store.
- Server Components may render the shell, access gates, and small bootstrap data. Do not make a migrated operational tab wait for a complete blocking Server Component table query before its page can appear.
- Expose narrowly scoped, typed server read contracts for module lists, reference data, details, and history. API routes must resolve the active organization through `resolveApiOrgContext`; the client-provided organization ID is a cache namespace, never authorization.
- Tenant data sent over HTTP must not enter a shared public Next.js/CDN cache. Keep it private and organization-scoped. Client cache keys must include the active organization plus module and normalized query state. Clear organization-scoped cache on organization switch and sign-out.
- Prefer canonical mutation results and targeted cache updates over `router.refresh()` or broad current-tab reloads. Optimistic UI is allowed only where rollback is unambiguous. The server remains authoritative; on failure restore the prior cache state and show a clear error.
- Do not remove fachlich necessary cross-module invalidation merely to improve a timing number. Replace broad `revalidatePath` behavior only after the affected query keys and dependent modules are explicitly mapped and covered by tests.
- Load heavy detail, document, receipt, return, cancellation, and history data only when the user opens the relevant drawer or dialog. Prefetch likely next data when useful, but never eagerly fetch every row's detail.
- Preserve URL-restorable search, filters, sort, views, and pagination. Debounce network-bound search while reflecting the typed value immediately. Use server-side pagination/filtering only when the result is mathematically correct; never paginate current and legacy inventories independently and merge them as though they were one ordered result set.
- Prepare the cache and mutation contracts for later Supabase Realtime and Presence integration, but do not implement live collaboration before the core tabs and measured performance behavior are stable. Realtime events will patch or invalidate the same organization-scoped query cache; Presence remains ephemeral and is not a business record.
- Migrate one tab at a time. The order is: shared foundation, `/lager` pilot, `/einkauf`, `/verkauf`, `/produkte`, then `/dashboard`; other operational modules follow only after the pattern is proven. Do not migrate several business tabs in one unreviewable change.
- Read `docs/plans/2026-08-01-001-hybrid-spa-performance-plan.md` before implementing this architecture. Use the prompts under `docs/codex-prompts/` in sequence.

## Performance Evidence Contract
- Separate cold development compilation from application runtime. Never claim an application performance improvement from a faster compile or from an unauthenticated request.
- Measure authenticated warm navigation and the actions users actually perform. Record at least median and slowest values, data/query counts, visible loading behavior, and whether cached data was shown.
- Interaction targets for migrated tabs: visible click/input feedback within 100 ms; cached tab revisit without a blocking full-page loader; optimistic or locally patched mutation feedback within 100 ms when safe; background server confirmation with an explicit pending/error state.
- The first uncached data load may show a table-local skeleton, but the app shell and page header must stay interactive. Use a warm authenticated target of under 1 second for the primary table response as a goal, report the actual result, and do not hide external database latency behind optimistic wording.
- Run only one local StorageX development server unless a test explicitly requires otherwise. Multiple instances previously exhausted the Supabase session-pool limit and produced `EMAXCONNSESSION`.

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

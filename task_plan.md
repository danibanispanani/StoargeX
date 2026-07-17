# Task Plan: Prompt 7 Team Task Management

## Goal
Evolve the existing task Kanban into a tenant-safe team workspace while preserving legacy tasks and archive behavior. Put assignment, permission, checklist/progress, activity, snooze, domain-link, notification, and import invariants behind one deep task module; expose the requested operational views and Kanban/list modes; document, verify, and commit the complete result.

## Current Phase
Local implementation, review, and commit complete; external QA database/browser validation remains deferred

## Confirmed test seams
- Task-domain module interface: assignment invariants, derived progress, archive/snooze, links, activity, notifications, and tenant checks.
- Permission-policy interface: explicit READONLY/MEMBER/ADMIN/OWNER decisions for create, self/team assignment, team edit, and archive.
- Existing import pipeline interface: task templates, user resolution, dry run/review, commit, ImportBatch, and SourceReference.

## Phases

### Phase 1: Evidence and compatibility audit
- [x] Read governance/domain/table/import docs plus task schema, migrations, actions, UI, activity, notifications, import/export, roles, and tests
- [x] Map existing Task data/archive compatibility and identify additive schema/service seams
- [x] Record permission matrix, notification semantics, domain-link strategy, and proof plan
- **Status:** completed

### Phase 2: Proof-first task domain and migration
- [x] Add failing tests for multiple assignees, checklist progress, permissions, archive/snooze, domain links, notification triggers, import resolution, and tenant isolation
- [x] Add a strictly additive migration with nullable/defaulted compatibility fields and RLS-safe relations
- [x] Implement task collaboration and permission modules without replacing legacy records
- **Status:** completed

### Phase 3: Team workspace, import/export, and notifications
- [x] Rebuild `/aufgaben` with the eight requested views plus Kanban/list presentation and meaningful derived progress
- [x] Add create/detail flows for assignments, primary owner, checklist, comments/activity, archive, snooze, and optional domain links
- [x] Extend the existing import/export pipeline and in-app notification surface; do not add unsafe uploads or external email infrastructure
- **Status:** completed

### Phase 4: Documentation and integrated verification
- [x] Create `docs/team-task-workflow.md` and update governing navigation/table documents where required
- [x] Run focused/full tests, Prisma validate/generate, typecheck, lint, and production build
- [ ] Deploy/status-check the additive migration, run integrity check, and perform authenticated browser QA against an explicitly confirmed isolated QA database
- **Status:** blocked on explicit confirmation that the `.env` database is isolated QA and approved for migration

### Phase 5: Simplify, review, and commit
- [x] Run simplification and structured code review; resolve all actionable findings and residuals
- [x] Confirm a secret-free clean diff and commit exactly `feat: rebuild tasks for team collaboration`
- **Status:** completed

## Constraints
- Preserve every existing task and the current archive behavior; no destructive migration or forced legacy rewrite.
- Authorization is enforced server-side and tested for every role.
- Checklist progress is derived; tasks without checklists use status rather than a fabricated percentage.
- Attachments are omitted unless the audit finds an existing secure upload foundation.
- Reuse AuditLog, ImportBatch, SourceReference, tenant RLS, role helpers, and operational table patterns.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Local portable PostgreSQL is unavailable and Docker is not supported on this laptop | 1 | Do not invent a second database runtime; use the existing external environment only after its purpose is explicitly confirmed |
| The default `.env` points to an external database, while `.env.qa.local` contains only QA account metadata and does not prove the database is isolated QA | 1 | Stop before `prisma migrate deploy`, integrity checks, authenticated browser QA, and commit; request explicit database-target confirmation |
| Sandboxed production build cannot fetch the three configured Google fonts | 1 | Re-ran the unchanged build with approved network access; the final build completed successfully |

---

# Historical Task Plan: Prompt 6 Customer and Supplier Return Center

## Goal
Split the operational return center into independent customer-return and supplier-return routes and tables, preserve the established relational customer-return allocation/movement workflow, deepen the additive supplier-return module around transactional inventory movements and document numbering, add separate dashboard/import/export surfaces, verify tenant and idempotency invariants, and commit the complete Prompt 6 result.

## Current Phase
Complete

## Phases

### Phase 1: Evidence and seam design
- [x] Read Prompt 0–5 governance/domain/table/import documents and the complete existing return, purchase, inventory-movement, dashboard, import/export, schema, migration, and test implementations
- [x] Map customer-return compatibility invariants, supplier-return foundation gaps, document-number conventions, route/navigation behavior, and tenant/RLS seams
- [x] Record the selected deep module interfaces and proof strategy before production edits
- **Status:** completed

### Phase 2: Proof-first domain and additive migration
- [x] Add focused failing/characterization tests for customer returns, supplier-return transitions, partial quantities, deadlines, shipment movements, refunds, rejection, idempotency, and tenant isolation
- [x] Extend only additive supplier-return/customer-return fields and migration structures; preserve existing R-numbers and introduce LR document sequencing
- [x] Implement transactional supplier-return planning, shipment, refund, rejection, and completion through InventoryMovement without direct quantity mutation
- **Status:** completed

### Phase 3: Separate operational return surfaces
- [x] Build `/retouren/kunden` with customer-specific presets, sale/return selection, inspection, financial, tracking, and evidence fields using the existing relational workflow
- [x] Build `/retouren/lieferanten` with supplier-specific presets, deadlines, shipment/refund/conflict handling, and guarded workflow actions
- [x] Add parent navigation, separate import templates/exports, and separate dashboard insights without merging the two domain tables
- **Status:** completed

### Phase 4: Documentation and integrated verification
- [x] Document architecture, workflows, movement/refund semantics, permissions, import/export, and compatibility in `docs/return-center.md`
- [x] Run focused and full tests, Prisma validate/generate, typecheck, lint, integrity check, migration status/deploy on the approved QA environment, and production build
- [x] Attempt browser verification and record the unavailable browser runtime without bypassing the security decision; Prompt 6 does not require browser QA as a gate
- **Status:** completed

### Phase 5: Review and commit
- [x] Simplify the completed diff while preserving the deliberate customer/supplier separation
- [x] Run the required code-review/fix/residual workflow, confirm no secrets/temp artifacts, and ensure a clean validated diff
- [x] Commit exactly `feat: split customer and supplier return workflows`
- **Status:** completed

## Constraints
- Customer and supplier returns remain separate operational modules, routes, configurations, imports, exports, statuses, responsibilities, and tables.
- Customer returns continue through `Return -> ReturnLine -> ReturnAllocation -> SaleLineAllocation -> InventoryMovement`; existing visible R document numbers remain unchanged.
- Supplier shipment is a transaction over selected inventory buckets/lots plus an InventoryMovement; no direct stock-counter mutation and no duplicate shipment booking.
- Supplier-return document numbers use the existing `DocumentSequence` seam with an LR-visible prefix; technical IDs remain internal.
- Existing purchases, purchase lines, inventory positions, lots, suppliers, RLS, AuditLog, ImportBatch, SourceReference, and calculation modules are extended rather than forked.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Prompt 6 proof tests fail because the new service, migration, and customer transition helper do not yet exist | 1 | Expected red phase; implement the contracts additively, generate Prisma, and rerun the same focused suite |
| Typecheck required labels for the three additive customer-return statuses | 1 | Added operational labels/options for inspection, defective, and completed; rerun typecheck after transactional tests |
| PowerShell `Get-Content` treated the `[table]` route segment as a wildcard | 1 | Re-read the route with `-LiteralPath`; no code impact |
| First Phase-3 typecheck found an over-wide inferred detail type and nullable `ActionState` mismatch | 1 | Load the same complete purchase/supplier relation used by the detail payload and type client workflow callbacks with the existing nullable `ActionState` |
| Default integrity check cannot reach the repository `.env` database from this environment | 1 | Run the approved isolated QA connection through ignored `.env.qa.local` after deploying the additive migration |
| Sandboxed production build cannot fetch the three configured Google fonts | 1 | Re-run the unchanged build with network escalation; no source workaround or font substitution needed |
| Repo-local `agent-browser` skill is installed but its CLI binary is unavailable | 1 | Use the available in-app Browser control skill for local visible QA instead of installing another browser runtime |
| In-app Browser reports no available browser; temporary third-party npx runner was blocked by the security reviewer | 1 | Do not bypass the security decision; retain the successful route-aware production build and automated UI/config tests, and record visible browser QA as unavailable in this session (Prompt 6 does not mandate browser QA) |

---

# Historical Task Plan: Prompt 5 Marketplace Price Calculators, Fee Catalogs and Expenses

## Goal
Extend the existing Prompt-1 fee/account/expense foundations into two marketplace-specific, deterministic pricing workflows for eBay.de and Kaufland.de, versioned reviewed catalogs, explicit product/snapshot integration, separate operating expenses, imports/exports, browser validation, documentation, and the requested commit without parallel models or unsupported official claims.

## Current Phase
Phase 6: complete; final commit pending

## Phases

### Phase 1: Evidence, sources, and architecture
- [x] Read all Prompt 0–4 documents, schema/migrations, calculations, sales/product/settings/forms, package scripts, and current history
- [x] Verify official eBay/Kaufland sources and inventory every existing fee/account/category/expense seam
- [x] Produce the required temporary architecture report and select the prompt-mandated deep Pricing module
- **Status:** completed

### Phase 2: TDD domain and additive migration
- [x] Write red tests at the pricing/catalog, snapshot, expense-recurrence, import, role, and tenant interfaces
- [x] Add only additive models/fields and a safe migration; create reviewed structured catalog fixtures with provenance
- [x] Implement cent-safe fee resolution, tax treatment, profit/margin, break-even, target margin, maximum purchase price, snapshots, staleness, and expense occurrence invariants
- **Status:** completed

### Phase 3: Product workflows and management surfaces
- [x] Build separate eBay and Kaufland calculators with saved/free modes and explicit save/update/convert actions
- [x] Add fee management, marketplace-account settings, expenses, product calculation view/bulk mappings, and purchase/sale integration at established seams
- [x] Extend the existing import/export pipeline for expenses, mappings, and calculation exports
- **Status:** completed

### Phase 4: Documentation and design polish
- [x] Create the five required documents and import report with only verified ACTIVE facts
- [x] Apply Huashu operational-console direction and Better Icons without a parallel prototype or decorative UI system
- **Status:** completed

### Phase 5: Database, browser, and quality gates
- [x] Validate/generate Prisma, deploy the additive migration to the approved test environment, run typecheck/lint/all tests/integrity/diff-check/build
- [x] Run Chrome/available browser validation at 1440/1280/768/390 with console/network/hydration/a11y checks and browser trace where supported
- **Status:** completed; the authorized isolated QA database is current and all browser/runtime checks pass

### Phase 6: Review and commit
- [x] Run ce-code-review and fix all locally inspectable in-scope findings; prepare ce-test-browser/ce-polish
- [x] Confirm no secrets, source-page dumps, temp files, or ambiguous ACTIVE rules; commit with the exact requested subject
- **Status:** complete; commit is the remaining shipping action

## Confirmed test seams
- `MarketplacePricingService.calculate`: deterministic calculation and fee breakdown from explicit inputs plus a reviewed catalog snapshot.
- `MarketplacePricingService.findBreakEven`: cent-exact bounded numerical result through the same calculation interface.
- Catalog resolver/import interface: category/profile/shop/condition/tier validity and unsupported states.
- Existing tenant-scoped action/service seams: saved calculation, product mapping/staleness, expense recurrence/import, role enforcement, and sale fee snapshot.

## Constraints
- No title classification, live fee scraping per calculation, product auto-mutation, automatic product creation, fixed-cost allocation, marketplace advertising beyond eBay basis ads, external marketplace APIs, or unsupported official claims.
- eBay and Kaufland keep separate route/UI interfaces while sharing one deep calculation implementation.
- Existing `MarketplaceAccount`, fee, product, expense, import, sale snapshot, tax, RLS, and role foundations must be extended rather than duplicated.
- An official catalog fact is ACTIVE only when directly supported by a documented supplied/official source and covered by tests; ambiguity remains REVIEW_REQUIRED.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| `integrity:check` cannot reach the configured Supabase PostgreSQL host from the restricted runtime. | 1 | Re-ran with the user's explicit external-QA approval after additive migration deployment; all 13 checks pass. |
| Production build reaches Next compilation but cannot download Inter, JetBrains Mono, and Space Grotesk from Google Fonts. | 1 | Re-ran with approved network access; the production build passes without altering the established font setup. |
| Migration/browser validation needs the existing QA database or an approved local Docker PostgreSQL runtime. | 1 | Docker Desktop was unavailable, so the user-approved isolated external QA database was migrated additively and used for browser verification. |

---

# Historical Task Plan: Prompt 4 Purchasing, Suppliers and Inbound Workflow

## Goal
Extend the existing Product -> Purchase -> PurchaseLine -> InventoryPosition -> OwnedStockLot -> PURCHASE_RECEIPT flow into an additive, tenant-safe procurement and partial-receipt workflow, with separate purchasing and stock workspaces, deadline attention, reusable import templates, tests, documentation, and no destructive legacy-data conversion.

## Current Phase
Phase 5: shipping tail

## Phases

### Phase 1: Architecture and behavior audit
- [x] Read the product constitution, roadmap, domain decisions, table matrix, operational table/import standards, schema, migrations, services, actions, routes, and tests that define purchasing and stock behavior
- [x] Record current invariants, extension seams, legacy compatibility constraints, and exact table-view requirements
- **Status:** completed

### Phase 2: Additive domain foundation
- [x] Add safe procurement, shipping, receipt, inspection, return-deadline, supplier, payment, and document fields/models without removing or requiring legacy data
- [x] Implement one transactional receipt interface for immediate, full, and partial inbound flows while preserving InventoryMovement and debt behavior
- **Status:** completed

### Phase 3: Operational UI and import integration
- [x] Add `/einkauf` and the required purchase presets using the shared operational-table mechanics
- [x] Extend `/lager` with the required inventory presets, inspection state, deadline visibility, and dashboard attention
- [x] Extend the existing import pipeline with purchase and inbound templates, simple-row compatibility, dry run, validation, and provenance
- **Status:** completed

### Phase 4: Verification and documentation
- [x] Cover direct/full/partial/multi-lot receipt, deadlines, movements, debts, tenant isolation, import templates, and view configuration
- [x] Document the delivered workflow and compatibility decisions in `docs/purchasing-and-inbound-workflow.md`
- **Status:** completed

### Phase 5: Shipping tail
- [x] Run focused and full quality gates, production-route checks, diff-scoped review, and fix all in-scope failures
- [x] Document the intentionally unapplied external migration and the resulting live-browser limitation
- [x] Confirm only intended changes, then commit with the exact requested subject
- **Status:** completed

## Constraints
- Preserve the existing movement-based inventory chain and established transactional services.
- No destructive migration, required legacy backfill, automatic supplier return, or parallel import engine.
- Keep supplier text fallback compatible while allowing a BusinessPartner reference.
- Customer and supplier returns remain separate workflows.
- New import paths must reuse ImportBatch and SourceReference and support template, validation, dry run, row errors, and review.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Looked for the Prompt-1 tenant test under the guessed name `domain-foundation-tenant-isolation.test.ts`; the file does not exist. | 1 | Located the actual `tests/beta-domain-tenant-isolation.test.ts` with `rg --files`; use that established RLS test surface. |
| The first large schema patch failed because its context contained mojibake-rendered comments rather than the file's UTF-8 text. | 1 | Split the edit into small ASCII-only context patches. The same mismatch later affected a combined documentation patch; create the new document separately and patch existing UTF-8 lines using their exact text. |
| A broad relation insertion matched `PurchaseLine.supplierReturnLines` instead of the later InventoryPosition field, creating an ambiguous Prisma relation. | 1 | Remove the misplaced singular relation and insert it beside `InventoryPosition.debtLinks`; rerun Prisma validation. |
| The first full suite failed because the exact navigation-route expectation had not yet included the new `/einkauf` route. | 1 | Add `/einkauf` to the existing navigation metadata regression test and rerun the complete suite. |
| Sandboxed `integrity:check` could not reach the configured Supabase database. | 1 | Repeat the required database gate with approved network access after deploying the additive migration. |

---

# Historical Task Plan: Persistent full-access QA account

## Goal
Provision a dedicated StorageX QA login that uses the existing credentials provider, has no 2FA requirement, belongs to an isolated organization with the highest supported role, receives every supported feature entitlement, and can be used repeatedly for autonomous browser testing without storing secrets in Git.

## Current Phase
Complete

## Phases

### Phase 1: Safety and architecture discovery
- [x] Identify the credential/password and 2FA fields, organization membership roles, subscription/entitlement gates, and existing seed/admin scripts
- [x] Determine whether the configured database is suitable for QA writes and whether its schema contains the required Prompt-1 tables
- **Status:** completed

### Phase 2: Idempotent account provisioning
- [x] Use or add a local-only provisioning path that never stores the generated password in tracked files
- [x] Create/update the QA user, isolated QA organization, maximum non-2FA role, subscription state, and available entitlement fallback without modifying unrelated users or domain data
- **Status:** completed

### Phase 3: Verification and handoff
- [x] Verify credential login, password-only state, organization membership, tier claims, and representative protected routes
- [x] Confirm repository scope and report reusable credentials securely to the user
- **Status:** completed

## Constraints
- No hardcoded production bypass, master password, or app-level authentication exception.
- Do not weaken 2FA for any existing user; only the dedicated QA account may have 2FA disabled.
- Do not write credentials to tracked files, planning files, logs, commits, or screenshots.
- Prefer an isolated QA organization and idempotent upserts so reruns do not duplicate data.
- Do not commit unless the user separately asks.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| PowerShell interpreted regex alternation in a double-quoted `rg` pattern as a pipeline. | 1 | Retry with a single-quoted regex and no shell pipeline in the command. |
| Sandboxed `prisma migrate status` reached only a generic schema-engine error for the configured Supabase host. | 1 | Repeat the same read-only status check with approved network access; do not infer schema state from the sandbox failure. |
| `agent-browser` is not installed globally. | 1 | Use the skill-documented `npx agent-browser` fallback; if package download is blocked, retain Chrome DevTools as the already-proven local browser driver. |
| `npx agent-browser skills get core --full` produced no output for more than 90 seconds in the restricted environment, and the non-PTY process cannot be interrupted through stdin. | 1 | Do not repeat the blocked package-download path; use the installed Chrome DevTools MCP already validated for this repository. |
| Unsandboxed `npx agent-browser` was rejected as unpinned third-party code/supply-chain risk, and Chrome DevTools tools are not exposed in this turn. | 1 | Do not retry or work around the rejection. Verify the real Auth.js credential/session HTTP chain against the running local app using only repository dependencies and endpoints. |
| Process-command-line inspection via `Get-CimInstance Win32_Process` is denied in the managed environment. | 1 | Do not escalate merely for diagnostics; the scoped Next dev session was stopped directly and port 3000 has no listener. |
| `prisma migrate deploy` stopped with P3018 because historical migration `20260709100000_product_brand` begins with a UTF-8 BOM, which PostgreSQL parsed before `ALTER`. | 1 | Inspect whether `products.brand` already exists. If it does, resolve only that failed migration as applied; otherwise repair through an explicit safe SQL path before continuing. |

---

# Historical Task Plan: Prompt 3 Unified Operational Table System

## Goal
Create a reusable, information-dense operational table module, extend the existing import pipeline with documented downloadable templates and review states, migrate only `/produkte` as the reference module, verify tenant-safe filter/export/action behavior, document the contracts, pass all quality gates, and commit the requested result.

## Current Phase
Prompt 3 complete; final commit and handoff

## Phases

### Phase 1: Recovery, evidence, and table/import audit
- [x] Read Prompt 0–2 governance, table matrix, product route/actions/tests, import pipeline, schema, and package scripts
- [x] Map existing table state, preferences, tenant seams, product references, and import/export behavior
- [x] Define measurable success criteria and record deliberate scope boundaries
- **Status:** completed

### Phase 2: Deep operational-table module
- [x] Define the small shared interface for query/view/selection state and module-local configuration
- [x] Implement and test case-insensitive search, sorting, combined/date filters, presets, persisted views, density, selection, pagination, and filtered export projection
- [x] Implement shared controls, sticky table frame, confirmation dialog, states, and detail drawer without erasing domain-specific cells/actions
- **Status:** completed

### Phase 3: Import-template standard on the existing pipeline
- [x] Extend the existing ImportExportBar/import pipeline rather than creating another engine
- [x] Add empty/example templates, CSV/XLSX where supported, required/format descriptions, dry-run mapping, errors, conflicts, and summary presentation
- [x] Test template contracts and retained ImportBatch/SourceReference provenance
- **Status:** completed

### Phase 4: `/produkte` reference migration
- [x] Create the product table configuration, server-side tenant-safe query/filter/sort/pagination/export seam, and saved-view adapter
- [x] Add standard/optional columns, category/brand filters, row edit/delete with reference check, safe bulk categorization, and detail drawer
- [x] Preserve existing product forms/actions and validate tenant isolation and active-filter export
- **Status:** completed

### Phase 5: Browser QA, documentation, review, gates, and commit
- [x] Validate responsive layout, keyboard/focus, drawers/dialogs, states, console/network/hydration, and representative product workflows in Chrome
- [x] Create `docs/operational-table-system.md` and `docs/import-template-standard.md`
- [x] Re-run integrity check and production build with restored tool/network allowance
- [x] Update acceptance documentation and run final diff review
- [x] Commit the completed gate evidence
- **Status:** completed

## Constraints
- Do not migrate every module; `/produkte` is the only full reference migration.
- Keep important operational information visible and move only secondary/history data into optional columns or details.
- Reuse existing product actions, ImportBatch, SourceReference, organization/RLS access, audit, and import/export foundations.
- No Prisma migration unless discovery proves it is strictly required; prefer existing user settings storage and additive application-level configuration.
- Common mechanics are central; product columns, presets, filters, drawers, and business actions stay module-specific.

## Success Criteria
- Pure state/configuration tests cover filtering, sorting, presets, persistence, selection including current-result select-all, and filtered export projection.
- Product queries and mutations remain organization-scoped; delete/reference and bulk-category paths are safe and tested.
- Import templates expose machine-readable columns plus human-readable required/format metadata and feed the existing dry-run workflow.
- `/produkte` works without horizontal document overflow at desktop/tablet/mobile widths and is keyboard operable.
- All repository gates pass and the final worktree is clean after the requested commit.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Focused proof-first tests fail because the operational-table/product-table modules and product template contract do not exist yet. | 1 | Expected red evidence; implement only the tested interfaces before rerunning. |
| The first product-action patch matched the update action's identical `findFirst` line and placed the reference preflight there. | 1 | Removed it from update, anchored the patch on `deleteProductAction`, and retained editability for referenced products. |
| A monolithic product-action patch failed on mojibake context in the final success string. | 1 | Split the patch around ASCII anchors and used the file's actual UTF-8 text for the final insertion. |
| Combined product-dialog/delete-button patch could not match the legacy mojibake confirmation string. | 1 | Patched the dialog separately and replaced the small delete-button file through `apply_patch` with UTF-8 safe confirmation UI. |
| Parallel and 30-second TypeScript runs returned no exit code because the process outlived the nested command yield. | 2 | Started a resumable command session and polled it; this exposed one real transition callback return-type error, which was corrected. |
| Import-context Promise destructuring did not match the newly inserted product-query order, breaking product conflicts and sale-reference lookup. | 1 | Aligned destructuring to `[inventoryRefs, products, saleRefs]`; no query or domain behavior was broadened. |
| First targeted lint orchestration outlived the direct wait, and the resumed run found one no-unused-expressions warning. | 1 | Polled the resumable lint session and replaced the statement ternary with an explicit branch. |
| Chrome DevTools, Next DevTools and Docker approval were rejected by the external usage limit. | 1 each | Did not retry through a workaround; recorded the missing browser evidence and kept external data read-only. |
| `integrity:check` cannot reach the configured external PostgreSQL host from the sandbox. | 1 | Recorded the network blocker; no destructive or production write was attempted. |
| Production Build cannot fetch Inter, JetBrains Mono and Space Grotesk from Google Fonts. | 1 | Recorded the network-only build blocker after compilation reached the font fetch. |
| Sandboxed dev server cannot reach Supabase during Chrome QA. | 1 | Verified the network boundary with the passing approved integrity check; restart the identical server with approved network access. |
| `Stop-Process -Id 100384` returned an internal PowerShell NullReferenceException. | 1 | Re-verified that PID 100384 still owned port 3000, then terminated only that verified Node process tree with `taskkill /PID 100384 /T /F`. |
| Chrome reported a successful click on an off-screen mobile `Details` control, but no drawer appeared and `wait_for` timed out. | 1 | Treat the saved accessibility reference as stale/off-screen interaction evidence; scroll the table action column into view, take a fresh snapshot, and retry from the current rendered state. |
| Fresh visible `Details` reference still produced no Sheet via the Chrome click command. | 2 | Component inspection confirms a standard Radix `SheetTrigger`; direct DOM activation opened it, and semantic, Escape, and focus-return checks passed. This isolates a Chrome coordinate-driver limitation rather than an app defect. |
| `prisma generate` could not replace the Windows query engine while Next Dev held it open. | 1 | Stopped the already-finished QA server and reran generation successfully. |

---

# Historical Task Plan: Prompt 2 Internal Design System and App Shell

## Goal
Create a compact, distinctive internal StorageX product language and responsive application shell, centralize shared app-state components, enforce consignment entitlements server-side, validate representative routes in real browsers, document the shell, and commit the verified result without reconstructing every module.

## Current Phase
Final review, quality gates, and commit

## Phases

### Phase 1: Recovery, tooling, and evidence
- [x] Confirm clean Prompt 1 baseline and recover planning context
- [x] Load Huashu direction, codebase-design, better-icons, planning, and ce-polish workflows
- [x] Inspect runtime/route architecture through codebase memory and Next.js tooling
- [x] Audit existing shell, navigation, auth/org context, components, styles, and representative pages
- [x] Record current browser baseline and tool limitations
- **Status:** completed

### Phase 2: Shell and design-system decision
- [x] Define the deep shell seam, route metadata, entitlement projection, visual motif, responsive states, and accessibility contract
- [x] Inspect shadcn capability/current Radix primitives and select icons through better-icons
- [x] Record design assumptions and scope before implementation
- **Status:** completed

### Phase 3: Shared shell implementation
- [x] Implement AppSidebar, MobileAppNavigation, AppTopbar, organization context, UserMenu, Breadcrumbs, PageHeader, and PageToolbar
- [x] Implement InsightStrip, EmptyState, ErrorState, LoadingState, FeatureGate, and AddonTrialBanner
- [x] Integrate the shell into protected routes while preserving module behavior and maximizing content/table space
- **Status:** completed

### Phase 4: Entitlement enforcement
- [x] Resolve consignment entitlement/trial state from Prompt 1 foundation
- [x] Project navigation visibility/add-on entry and trial duration consistently
- [x] Enforce consignment access server-side without deleting or mutating data
- **Status:** completed

### Phase 5: Browser polish and accessibility
- [x] Run ce-polish with the existing Next.js 15-compatible path
- [x] Check Dashboard, Lager, Verkauf, Aufgaben, and Einstellungen at 1440/1280/768/390
- [x] Check keyboard/focus, sidebar states, mobile navigation, console, network, and hydration
- [x] Fix verified shell defects and recheck affected flows
- **Status:** completed

### Phase 6: Documentation, gates, and commit
- [x] Create `docs/internal-app-shell.md`
- [x] Run typecheck, lint, tests, integrity, production build, and diff checks
- [x] Review scoped diff and commit `feat: rebuild internal app shell and navigation`
- **Status:** completed

## Constraints
- Do not reconstruct every module or introduce unrelated domain/schema changes.
- Preserve existing mutation services, route behavior, organization/RLS boundaries, and user data.
- Avoid generic admin-template card grids, purple glow, decorative workflow motion, and excessive rounding.
- Use motion only for navigation, drawers, status/feedback, and context transitions; respect reduced motion.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| PowerShell interpreted the unquoted `app/(app)` path as an expression while listing route files. | 1 | Re-run file discovery with the route path quoted as a literal. |
| The first `ce-work` skill path assumed a repo-local install, but the skill is plugin-cached. | 1 | Read the advertised `r1` plugin-cache path instead. |
| A combined planning patch used a progress line that was not present yet. | 1 | Apply each planning-file update against its actual Prompt 2 section. |
| A later combined plan patch hit a duplicated checklist line left by an earlier edit. | 1 | Removed the duplicate and applied the state transition against the current file. |
| `better-icons` was not installed globally. | 1 | Used the skill-prescribed `npx --yes better-icons` fallback; no repository dependency was added. |
| A Windows `rg` invocation used an unsupported positional `**/*.test.*` glob. | 1 | Use `rg --glob '*.test.*'` or search `tests` directly. |
| Initial Chrome navigation timed out while Turbopack compiled `/login`. | 1 | Waited for compilation; the route then returned 200 and the warm server remains available. |
| The configured external database was unsuitable for destructive QA seeding. | 1 | Started an isolated local PostgreSQL container and used a local-only QA tenant. |
| Historical migration `20260709100000_product_brand` contains a UTF-8 BOM and failed local `migrate deploy`. | 1 | Left historical migrations untouched; used `prisma db push` only for the disposable browser-QA database and documented the existing defect. |
| Initial 390-px emulation exposed a dashboard min-content overflow. | 1 | Added `min-w-0` to the two table-containing cards and rechecked at an actual 390-px layout viewport. |
| Documentation text contained four mojibake remnants after a shell encoding conversion. | 2 | Replaced the exact affected lines with `apply_patch` and verified UTF-8 content. |

---

# Historical Task Plan: Prompt 1 Additive Domain Foundation and Feature Entitlements

## Goal
Add the beta domain foundation through additive Prisma models/migrations, small central modules, tests, documentation, full validation, and the requested commit without replacing existing production logic or deleting data.

## Current Phase
Final review and commit

## Phases

### Phase 1: Recovery, evidence, and architecture
- [x] Confirm clean Prompt 0 baseline and recover planning context
- [x] Load requested planning, architecture, design, and diagnosis skills
- [x] Read all required governance, schema, domain modules, and tests
- [x] Refresh codebase-memory architecture
- [x] Complete and inspect the architecture report
- **Status:** complete

### Phase 2: Additive domain design
- [x] Decide existing extensions versus new models and safe nullable/default transitions
- [x] Define RLS, indexes, constraints, delete behavior, snapshots, and compatibility rules
- [x] Record the design in findings before editing schema
- **Status:** complete

### Phase 3: Schema and migration
- [x] Extend Prisma schema additively
- [x] Add a hand-reviewed additive SQL migration with RLS policies and constraints
- [x] Do not remove columns, force legacy migration, or rewrite productive logic
- **Status:** complete

### Phase 4: Central modules and tests
- [x] Add entitlement, marketplace-account, expense-recurrence, and condition modules
- [x] Add fee-rule validity support and task-assignment invariants
- [x] Add focused unit and migration-contract coverage including tenant isolation
- **Status:** complete

### Phase 5: Documentation and validation
- [x] Create `docs/domain-foundation-phase.md`
- [x] Run Prisma validate/generate, typecheck, lint, tests, integrity check, and production build
- [x] Diagnose and fix failures through tight focused loops
- **Status:** complete

### Phase 6: Final review and commit
- [x] Review schema/migration safety and scoped diff
- [x] Verify no productive data deletion or logic replacement
- [x] Commit `feat: add beta domain and entitlement foundation`
- **Status:** complete

## Constraints
- Additive only: no removed column/model/enum value and no forced legacy data conversion.
- Existing strings for suppliers, partners, payout recipients, conditions, and tasks remain readable.
- Secrets remain only in Credential; account metadata must contain no secrets.
- Entitlements gate capability, never data retention.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Initial monolithic schema patch missed a Unicode comment context line | 1 | Split schema changes into smaller ASCII-context patches; no partial schema edit was applied. |
| Prisma schema diff rejected the temporary baseline because PowerShell added a UTF-8 BOM | 1 | Regenerate the temporary baseline as UTF-8 without BOM, then rerun the same schema-to-schema diff. |
| Two condition-mapping tests failed because Unicode NFD normalizes umlauts to `a/u`, while aliases used `ae/ue` | 1 | Support both normalized and transliterated spellings, then rerun the focused test. |
| Typecheck found two complete `InventoryPosition` test fixtures without the new nullable property | 1 | Set `itemCondition: null` explicitly in the legacy fixtures; production logic is unchanged. |
| Sandboxed integrity check could not connect to the configured Supabase database | 1 | Repeated the same read-only check with network access; all 13 checks passed. |
| Sandboxed production build could not fetch three existing Google Font families | 1 | Repeated the identical build with network access; compilation, type validation, static generation, and tracing passed. |
| Sandboxed `git add` could not create `.git/index.lock` | 1 | Repeat the explicitly authorized staging/commit with Git metadata write access. |

---

# Historical Task Plan: Prompt 0 Internal Product Constitution and Beta Rebuild Planning

## Goal
Define the internal StorageX product constitution, beta-rebuild roadmap, domain-generalization decisions, table-view matrix, and entitlement/navigation map without implementing domain or schema changes.

## Current Phase
Final verification and handoff

## Phases

### Phase 1: Repository and governance audit
- [x] Confirm clean worktree, inspect diff and recent history
- [x] Read project instructions, package, Prisma schema, existing planning notes, and documentation inventory
- [x] Index the repository through codebase memory and inspect architecture
- [x] Check limited browser/Next.js tooling availability
- **Status:** complete

### Phase 2: Domain, UI, and migration evidence
- [x] Read all domain/redesign documents and relevant migration history
- [x] Inspect current module routes, tables, actions, and services
- [x] Capture architecture-deepening opportunities for the roadmap
- **Status:** complete

### Phase 3: Product constitution and planning documents
- [x] Extend AGENTS.md with internal SaaS governance
- [x] Create all five requested governance documents
- [x] Keep phases implementation-free and schema-free
- **Status:** complete

### Phase 4: Final verification and handoff
- [x] Verify only AGENTS.md and documentation files changed
- [ ] Review staged diff and commit the requested message
- **Status:** in_progress

## Constraints
- No new domain feature, Prisma migration, UI reconstruction, or tariff change.
- Preserve all listed multi-tenant, inventory, transaction, allocation, debt, import, and audit foundations.
- Commit only the requested documentation/governance scope.

## Tooling Notes
- codebase-memory-mcp indexed `C:\\dev\\StoargeX` in moderate, non-persistent mode: 2,037 nodes and 5,765 edges.
- The project is on Next.js 15.5.20. `next-devtools` found no MCP-enabled server; framework upgrade is out of scope.
- Chrome DevTools is callable but has only `about:blank` open, so no live application route can be compared without starting a server; this planning phase does not require an app change.

---

# Historical Task Plan: Prompt E Public Experience Polish

## Goal
Polish the complete public experience across Landingpage, Auth, Footer, Legal pages, navigation, question interaction, motion, and responsive behavior; validate it end to end, document the result, pass every gate, and commit it.

## Current Phase
Complete

## Phases

### Phase 1: Recovery and Consistency Audit
- [x] Confirm clean Prompt A–D baseline on a non-main branch
- [x] Load ce-polish, ce-test-browser, Huashu motion guidance, Better Icons, Browser Trace, planning, and surgical-change guidance
- [x] Inspect all public routes, shared styles, motion helpers, and interaction components
- [x] Establish a concrete defect/polish list before editing
- **Status:** complete

### Phase 2: Public-System Polish
- [x] Align navigation, Footer, legal/about surfaces, CTA language, links, cards, and spacing
- [x] Refine controlled hero, reveal, route, CTA, Auth, and transition motion
- [x] Upgrade the landing question element into a coherent lightweight interaction flow
- [x] Preserve reduced-motion, keyboard, and form accessibility
- [x] Create `docs/public-polish-report.md`
- **Status:** complete

### Phase 3: Runtime and Browser QA
- [x] Start the Next.js dev server using the resolved project recipe
- [x] Check next-devtools compatibility and shadcn audit guidance
- [x] Run ce-test-browser scope across all affected public routes with Chrome DevTools
- [x] Verify desktop, tablet, and mobile layouts, navigation, forms, links, question flow, console, network, and hydration
- [x] Apply the existing Browser Trace limitation without repeating the known blocked Windows launcher
- **Status:** complete with documented Browser Trace limitation

### Phase 4: Accessibility and Performance
- [x] Run Lighthouse accessibility/best-practices checks on representative Landing and Legal routes
- [x] Capture a coarse performance trace and inspect motion behavior
- [x] Fix scoped defects and rerun affected checks
- **Status:** complete

### Phase 5: Shipping Gates
- [x] Run TypeScript, full lint, all tests, production build, and `git diff --check`
- [x] Review the final scoped diff
- [x] Commit with a clear Prompt E message
- **Status:** complete

## Design Decisions
| Decision | Rationale |
|---|---|
| Treat motion as physical continuity, not decoration | The Transit Ledger metaphor should feel like one system moving through gates, rails, and manifests. |
| Use Expo-out style easing and small directional travel | Gives weight and clarity without continuous spectacle or layout-costly animation. |
| Keep one memorable motion peak in the Hero/question flow | Huashu guidance favors restraint; the rest of the system should support comprehension. |
| Extend existing components rather than add a new design layer | Prompt E is polish, not another redesign or architecture rewrite. |

## Constraints
- Public experience only; no inventory, auth backend, billing, middleware, or protected-app changes.
- No invented AI backend, customer claims, legal text, or external integrations.
- Preserve Prompt A–D architecture and interaction contracts.
- Next.js 15 may limit next-devtools runtime inspection; document and continue.

## Errors Encountered
| Error | Resolution |
|---|---|
| ce-polish Bash helper scripts resolve to WSL, but no WSL distribution is installed | Use the documented Next.js/npm/port recipe directly in PowerShell; do not retry identical helpers. |
| Preferred port 3000 is occupied by an unresponsive existing process | Preserve the unknown process and start the scoped QA server on port 3005. |
| next-devtools finds no MCP endpoint on port 3005 | Expected Next.js 15.5.20 limitation; continue with Chrome DevTools and static route inspection. |
| Chrome DevTools screenshots intermittently remain pending after interactive navigation | Terminated two isolated screenshot calls, stopped requesting screenshots, and retained successful snapshots, Lighthouse, and DOM geometry evidence. |
| Initial Auth motion inspection queried a pseudo-element as a DOM node | Corrected the inspection to `getComputedStyle(element, "::after")`; verified finite animation counts. |

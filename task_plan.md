# Task Plan: Prompt 3 Unified Operational Table System

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

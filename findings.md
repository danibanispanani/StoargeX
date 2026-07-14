# Findings and Decisions

## Prompt 5 — Marketplace Price Calculators, Fee Catalogs and Expenses

### Execution frame
- The branch starts clean at `3eb3731`; Prompt 5 is a cross-layer additive phase and must end before Prompt 6.
- The prompt explicitly preselects the top architecture candidate: a deep deterministic Marketplace Pricing module with a small calculation/break-even interface. Marketplace-specific route modules remain separate callers; fee resolution, rounding, tax, profit, margin, and numerical search stay behind the seam.
- TDD seams are confirmed in `task_plan.md`: pricing/catalog interfaces plus established tenant-scoped domain actions. Tests must use independent worked literals and must not reproduce formulas tautologically.
- Huashu is applied as design direction only because its own routing excludes production backend apps. StorageX's existing operational-console design system is authoritative; no prototype, logo download, or separate UI framework is warranted.
- `improve-codebase-architecture` will produce its required report in `%TEMP%`, not the repository. The user request already selects the Pricing module candidate, so the report informs implementation without an extra blocking choice.
- Browser Trace requires the external `browse cdp` CLI; availability will be checked once, logged, and a supported Chrome/Browser path used if unavailable.

### Tool availability
- The current tool catalog does not expose callable codebase-memory, shadcn, Chrome DevTools, Next DevTools, or Better Icons MCP methods directly. Local repository search/design-system inspection is the safe fallback; unavailable Context7 is non-blocking by prompt.

### Governing document evidence
- Prompt 1 already owns the required foundations: `MarketplaceAccount`, `FeeSchedule`, versioned `FeeRule`, `ExpenseCategory`, `Expense`, `ExpenseRecurrenceRule`, canonical `ItemCondition`, and tenant/RLS rules. Its documented fee selector is policy-only and does not yet alter sales calculations.
- Product categories are intentionally distinct from marketplace fee categories. Existing `Product.category` remains internal; Prompt 5 needs additive marketplace-category references/mapping status and immutable calculation/sale snapshots.
- The operational-table module owns query/preferences/selection framing while each marketplace, fee, expense, and product-calculation route must keep its own definition and mutations.
- Prompt 4 leaves its additive migration unapplied on the configured external QA database. Prompt 5's required database/browser gates therefore depend on explicit approval to deploy both pending additive migrations in order; this must not be silently bypassed.
- Existing app-shell navigation intentionally omitted fees/profit/expenses until their domain phase. Prompt 5 is the authorized phase to add only real routes.
- Current product editing is intentionally small (`name`, internal `category`, brand/EAN/size/default EK); marketplace category mappings, condition defaults and shipping/packaging defaults need additive fields or separate mappings without repurposing `Product.category`.
- Current sale entry accepts a tenant platform plus manually entered fee amounts. It does not resolve a marketplace account or persist the source catalog/version/rule inputs; integration must keep manual override while adding a proposal and immutable snapshot.
- Existing settings still manages tenant `Platform` records as if they were accounts. Prompt 5 needs a dedicated marketplace-account surface while preserving those legacy platform controls for compatibility.
- The product operational table already has the shared workspace mechanics and detail drawer. Prompt 5 should extend its module definition/row details instead of introducing another table framework.
- Official eBay DE business-fee page (checked 2026-07-14) states that displayed fees exclude VAT; final value fee is a percentage of total transaction amount plus €0.35/order, or €0.45 for orders over €10.00; total transaction includes item, buyer-paid shipping, VAT and other charges. Its published category table supplies category IDs, condition discounts and tiered thresholds. These are safe source facts, but seller-status and shop-specific exceptions must remain explicit rule dimensions.
- Official Kaufland conditions page (checked 2026-07-14) publishes DE category commissions from 7% to 16%, with media at 13% + €0.70/item; commission basis is gross selling price including shipping, with VAT added to the commission. Basic is €39.95/month and Plus €59.95/month net. Monthly plans belong in account/expense defaults, not unit contribution margin.
- No separate eBay fee-catalog attachment exists alongside the supplied prompt. The official eBay page is sufficiently detailed for a curated initial subset, but any unrepresented exception must be `REVIEW_REQUIRED` rather than silently generalized.
- The existing import engine is a single `TableKey` registry plus one dry-run/commit service with `ImportBatch` and `SourceReference`; Prompt 5 imports must extend this registry/service, not create fee- or expense-specific upload engines.
- The repo has only basic shadcn primitives (no command/combobox/popover package wrapper), while `lucide-react` is already installed. New searchable selectors should reuse the established accessible input+datalist/listbox patterns unless the requested icon/primitive tools are actually callable.
- Local PostgreSQL bootstrap and Docker scripts exist. The migration gate can target an isolated local database and avoid touching the configured shared/external environment.
- Navigation is defined under `components/layout`; Prompt 5 can add the real finance/settings routes to the shared desktop/mobile source once those pages exist.
- The pricing kernel now treats all money as integer cents and rates as integer basis points. Percentage components round independently to cents; tiered commissions are marginal; fee VAT is separated from profit-effective fee cost; monthly account costs are structurally fixed at zero in product results.
- The break-even service reuses the exact calculation function, searches a bounded cent interval, returns the first non-loss cent and emits an explicit `NO_BREAK_EVEN` error at the configured ceiling.
- `better-icons` is not installed as a callable CLI/MCP in this environment. The implementation therefore uses the project's existing Lucide dependency and established icon vocabulary; no additional icon package was introduced.
- The initial eBay catalog intentionally activates only the source-backed subset expressible without ambiguity. Sneaker, complex watches/jewelry and automotive exception families remain explicit review notes; Kaufland.de's published 13 fee groups are fully normalized.
- Expense CSV/XLSX support extends the existing `TableKey` registry and dry-run/commit service. Recurrences receive a deterministic `ruleId:YYYY-MM-DD` occurrence key, making repeat materialization idempotent at both service and database levels.
- Existing calculation convention mixes integer cents for service functions with Prisma Decimal at persistence seams. Marketplace pricing should remain integer-cent based internally and convert only at storage adapters.
- Final review confirmed that quantity denotes item count: item sale price and purchase price scale by quantity, buyer-paid shipping and direct order costs apply once, and fixed per-item fees scale separately. Break-even and maximum-EK results are therefore per item.
- `FeeRule.minimumFeeCents` and `maximumFeeCents` are now honored by the same deterministic commission path; their earlier schema-only presence would otherwise have produced misleading future catalog results.
- Catalog activation must update matching `MarketplaceAccount.defaultFeeScheduleId` in the same transaction. Without this, calculators used the new active schedule while later sale snapshots could still cite the archived account default.
- A free calculation is converted to Product + confirmed mapping + converted snapshot atomically under tenant RLS. Partial conversion is not an acceptable failure mode.
- Offline verification is complete. Remaining gates need the configured QA database/network or approved local Docker runtime; this is an environment authorization boundary, not an unresolved code/test failure.

---

## Prompt 4 — Purchasing, Suppliers and Inbound Workflow

### Execution frame
- Prompt 4 is a large cross-layer change, but the user supplied an implementation-ready contract and explicitly wants it completed on top of Prompts 0–3; continue on the existing feature branch without creating a parallel foundation.
- The deep-module seam is the transactional inbound operation: callers should express direct, full, or partial receipt intent; the service must own Purchase/PurchaseLine, receipt/lots, InventoryPosition, InventoryMovement, debt, and audit consistency.
- Additive schema evolution must keep legacy supplier/payment/condition text readable and nullable while allowing configured BusinessPartner, PayoutAccount, and Condition references.
- Receipt tests must assert observable inventory/debt outcomes through the service interface, including partial and multiple-receipt behavior; internal helpers are not the contract.
- No supplier return is triggered by a deadline. Deadlines are stored attention signals with explicit user-confirmed follow-up.

### Skill-derived constraints
- `codebase-design`: centralize mechanics but keep purchase/stock presets, columns, and actions module-specific; avoid a shallow universal service or test-only public ports.
- `ce-work`: use proof-first or characterization-first evidence for behavioral slices, inspect the real cross-layer persistence chain, test continuously, then run the required shipping workflow and diff-scoped review.

### Initial code map
- Purchasing behavior is concentrated in `lib/services/owned-purchase-service.ts`; stock mechanics are in `lib/services/inventory-service.ts`; debt automation has its own service and relational link models.
- The current protected stock UI is `app/(app)/lager/page.tsx`; `/einkauf` does not yet appear in the relevant file map.
- The shared import surface already consists of `lib/actions/import.ts`, `lib/services/import-migration-service.ts`, `lib/import-export.ts`, the import/export bar, template route, and focused import tests. Prompt 4 must extend this chain.
- Schema already contains `PurchaseStatus`, Purchase/PurchaseLine, position/lot/movement models, BusinessPartner/PayoutAccount, and separate SupplierReturn models. The audit must determine which requested fields are already present before adding anything.
- The only dirty files at Prompt-4 start are the persistent planning logs; no product or schema edits pre-exist.

### Product and table contracts
- The current table matrix defines purchase standard columns as purchase number, date, supplier, status, lines, gross/net, payment account; optional fields are tax treatment, debt link, comment, and import source. Its drawer adds header, lines, created lots/positions, debt, movements, provenance, and audit.
- The current stock matrix keeps inventory number, product, available/original quantity, state, supplier, received date, cost, and listings visible; EAN/variant/size/payment account/purchase-return state/location/source remain optional, with full lot/movement/listing/provenance detail in the drawer.
- Prompt 4 explicitly expands the preset names beyond the older matrix. The column and evidence contract remains authoritative; the newer prompt governs the required view set.
- The operational-table seam already separates shared URL/persistence/selection mechanics from module-specific query, columns, presets, drawer, and actions. Purchasing and stock should each add their own configuration rather than change the generic module into a domain engine.
- Import templates are registry-driven and already guarantee CSV/XLSX variants, metadata, mapping preview, non-writing dry run, blocking errors/conflicts, tenant-scoped commit, ImportBatch/SourceReference, and audit. Purchasing/inbound add registry/planner/commit adapters only.

### Existing-domain evidence
- The authoritative owned flow is explicitly documented as Purchase -> PurchaseLine -> OwnedStockLot -> InventoryPosition -> InventoryMovement; no second lot table or stock counter is allowed.
- The legacy `/lager` combines old StockItem rows and current InventoryPosition rows. New owned rows already enter through `createOwnedPurchase`; legacy editing/import compatibility must remain available while `/einkauf` becomes the procurement projection.
- Existing purchase documents currently expose only DRAFT/CONFIRMED/CANCELLED semantics. Procurement and supplier-shipping states must be additive and must not reinterpret old rows destructively.
- Supplier references should prefer BusinessPartner while retaining `Purchase.vendor` and `OwnedStockLot.vendor` as readable document snapshots and import fallbacks.
- The audit records a historical named-person debt rule. Prompt 0/1 governance supersedes that pattern: new behavior must resolve configurable payment-account semantics and preserve legacy labels only for compatibility.
- Current focused implementation surfaces are substantial (`owned-purchase-service` 356 lines, inventory service 658, stock actions 559, stock page 250); changes should deepen the owned-purchase interface rather than distribute receipt orchestration across UI actions.

### Schema and service audit
- Prompt 1 already added nullable `Purchase.businessPartnerId` and `paymentAccountId`, central `ItemCondition`, separate SupplierReturn/SupplierReturnLine, and `SUPPLIER_RETURN_OUT`; these foundations must be reused.
- Purchase still lacks supplier order/reference, expected/actual delivery, carrier/tracking, shipping state, stored return deadline, documents, and receipt entities. PurchaseLine also has no received quantity or receipt relation.
- The current `createOwnedPurchase` always creates a CONFIRMED Purchase, every line, one InventoryPosition/OwnedStockLot per line, and immediately posts one PURCHASE_RECEIPT movement. It cannot represent an order before receipt or multiple partial receipts.
- Safe additive design: preserve `createOwnedPurchase` as the immediate-receipt compatibility adapter; add an order command plus a receipt command. Each accepted receipt-line slice creates its own InventoryPosition/OwnedStockLot and movement, allowing multiple lots and preserving immutable cost/condition snapshots.
- Receipt completion should be derived from summed receipt-line quantities against ordered quantities, not a mutable stock counter. Stored header `receivedAt` marks complete receipt (or the latest receipt only if explicitly named); a dedicated receipt header provides the actual event timeline.
- Existing document numbers cover purchase and inventory positions. Receipt records can use their purchase/sequence context without inventing another public document sequence unless the UI contract proves one is needed.

### UI/import reference patterns
- `/produkte` demonstrates the intended module split: a pure table-definition/query builder, a server page that resolves tenant-scoped projections, and a module table inside the shared workspace. Prompt 4 should follow this shape for purchases rather than reuse the legacy StockTable as its procurement table.
- `/lager` currently remains a mixed current/legacy stock projection and is capped at 500 rows. Prompt 4 can add its required stock presets and inspection/defect projection without moving procurement records back into that table.
- `createStockItemAction` is the required immediate-receipt compatibility entry point; it should keep calling `createOwnedPurchase`, which becomes an adapter over the new order-and-receive interface.
- Current import registry has `lager` but no `einkauf` or `wareneingang`. The new definitions need complete field metadata and examples; the import planner/commit path must distinguish creating an unreceived order from posting an inbound event.
- Existing owned-purchase tests characterize line planning and derived stock state only. Prompt 4 needs new proof around receipt allocation/completion/deadlines plus transactional behavior through the service seam.

### Migration and isolation pattern
- The Prompt-1 migration applies nullable foreign keys and new tenant-owned tables additively, then explicitly enables/forces RLS with organization and bypass policies. New receipt tables must use the same policy template and organization-scoped indexes.
- Existing Organization already owns purchases and supplier returns; it will need receipt relations only if Prisma requires the backrelation. Purchase/PurchaseLine/InventoryPosition/OwnedStockLot need direct receipt relations for efficient completion and detail projections.
- The established tenant-isolation regression file is `tests/beta-domain-tenant-isolation.test.ts`; the earlier guessed filename was incorrect.

### Implemented Prompt-4 architecture
- `PurchaseReceipt`/`PurchaseReceiptLine` are the missing event layer. Each receipt line owns a unique InventoryPosition and inbound movement reference; repeated partial receipts naturally become separate lots.
- `createPurchaseOrder`, `receivePurchase`, and the preserved `createOwnedPurchase` compatibility adapter form the single purchasing interface. Orders create no stock; receipt confirmation owns all inventory side effects.
- Intake inspection is represented without corrective counter writes: PURCHASE_RECEIPT targets AVAILABLE, INSPECTION, or DEFECTIVE through the inventory service according to the recorded inspection status.
- `/einkauf` uses the shared Prompt-3 workspace with module-specific query, presets, columns, saved views, selection, pagination, detail evidence, receipt action, imports, and filtered exports. `/lager` retains the mixed current/legacy stock projection and gains its separate required presets.
- Return deadlines remain stored evidence. UI provides textual/color status and dashboard attention with an explicit next action; no automated SupplierReturn or movement is created.
- Purchasing and inbound imports extend the registry/planner/commit path. Five-column simple input is supported; an optional StorageX purchase number distinguishes receipt-against-order from direct inbound.
- Configured SHAREHOLDER_PRIVATE payment accounts now supply a BusinessPartner/display-name debt creditor; named legacy payment labels remain a compatibility fallback only.

## Prompt 2 — Internal Design System and App Shell

### Baseline and direction
- Prompt 2 starts from clean commit `88b0756 feat: add beta domain and entitlement foundation`.
- Huashu explicitly routes production web applications away from its standalone HTML-prototype path. For this phase it supplies design-direction and anti-slop criteria only: content-derived form, honest density, one deliberate visual signature, no decorative imagery, no purple AI glow, and no card/icon filler.
- The shell should be a deep module: callers provide route content while navigation metadata, responsive state, entitlement projection, breadcrumbs, and shared chrome stay local to one shell seam.
- Next.js is pinned to 15.5.20, so native Next.js 16 MCP runtime inspection is expected to be unavailable; static inspection and Chrome DevTools remain the compatible path.
- The requested shadcn MCP is not exposed in this session. Existing Radix/shadcn-style primitives and local component conventions will be audited before deciding whether any registry primitive is necessary.
- Codebase memory was refreshed successfully (`StorageX`: 2,422 nodes / 6,307 edges).
- `nextjs_index` found no MCP-enabled server, consistent with the pinned Next.js 15 baseline. Prompt 2 will not upgrade the framework; ce-polish/Chrome DevTools provide the runtime path.
- The current server layout mixes authentication redirects, theme lookup, organization/role display, theme control, sign-out, and responsive navigation. Prompt 2 should split these into a server-owned shell composition and focused client controls.
- The current navigation is a single flat list. Its desktop breakpoint starts at `md`, which sacrifices too much module width at 768 px; the new desktop rail should start at `lg` and use a grouped mobile drawer below it.
- The existing mobile overlay is a hand-rolled fixed panel without dialog semantics or explicit focus/Escape handling. Reuse the repository's accessible Radix/shadcn-style overlay primitive if present.
- `app/globals.css` already supplies a distinctive operational palette (`ink`, `fog`, `cargo`, `transit`, `rail`, `stamp`) and Space Grotesk/Inter/JetBrains Mono typography. The internal shell should reuse those tokens instead of inventing a second visual language.
- The public shell already contains a compact package/ledger brand motif; the internal app can echo that motif at working-console scale without importing the public marketing layout or motion.

### Initial form hypothesis
- Narrative role: operational frame, never marketing hero.
- Viewing distance: laptop/desktop primary, touch handset secondary; body and labels must remain legible at high information density.
- Visual temperature: calm, authoritative, slightly industrial, with StorageX brand DNA expressed through typography, ink/teal accents, rules, and operational status—not gradients or glow.
- Capacity: navigation and topbar must consume less space than current module content; tables retain the largest possible viewport.
- Content-derived motif: a storage ledger/rail index—precise vertical grouping, compact row rhythm, fine rules, and an active-position marker—rather than rounded dashboard cards.

### Architecture evidence
- The existing shell seam is already concentrated in `app/(app)/layout.tsx` and `components/layout/app-sidebar.tsx`; it should be deepened rather than layered with a second shell.
- Protected page entry points consistently depend on the high-fan-in `requireOrg` module. Entitlement resolution belongs alongside that server layout/route seam, while client navigation receives only a serializable projection.
- Existing UI primitives form a cohesive component cluster (78 members, cohesion 0.89), and tables already cross a stable table seam. The shell must not pull module data/mutations into layout code.
- Representative route entry points are Dashboard, Lager, Verkauf, Aufgaben, Einstellungen, and Konsignation; these align with the requested browser matrix.
- Local UI primitives already include Radix-backed `Sheet`, `DropdownMenu`, `Avatar`, `Button`, and `Badge`. They cover the accessible shell interactions without adding a package or generating a second primitive layer.
- The route tree currently has no standalone Einkauf, Lieferantenretouren, Profit-Rechner, Gebührenregeln, or Ausgaben pages. Navigation will group only real routes; Lager can retain its existing Wareneingang responsibilities until those modules are built in their own phases.
- The entitlement evaluator preserves legacy BUSINESS access and selects active grants across subscription, add-on, trial, and manual sources. A server adapter can query the active organization once and pass a small serializable decision to shell clients.
- The current Konsignation page performs its tenant reads before any entitlement decision, and every consignment mutation independently calls `requireOrg`. Server enforcement therefore needs both a page-level decision before module queries and an action-level guard before mutations.
- Existing session membership summaries are sufficient to present the current organization/role. Organization switching will remain explicitly prepared unless an existing authoritative switch action is found; Prompt 2 will not invent session mutation logic.
- Auth.js already supports `activeOrgId` updates and refreshes membership claims, but only registration/invitation currently invoke it. A small server action can safely add switching by revalidating the requested membership in the database before calling `updateSession`.
- Chrome reached `/login?callbackUrl=%2Fdashboard` after the protected-route redirect. Turbopack compiled successfully; sandboxed Google Font requests emitted fallback warnings but did not produce a route error.
- The local dev server runs Next.js 15.5.20 on port 3000. Native Next MCP remains unavailable by version, while Chrome DevTools is connected and can provide DOM, console, network, and viewport checks.
- The repository intentionally has no seed script or documented demo credentials. Browser verification of protected routes must not invent an authentication bypass or mutate an unknown database merely to fabricate coverage.
- The final shell resolves active membership and organization from the database, then memoizes tenant and feature decisions only inside the current React server request. Session membership summaries remain presentation/switcher candidates, not the authoritative tier source.
- An expired or revoked entitlement is a normal form-submission outcome: all consignment mutations convert only `FeatureAccessDeniedError` into `ActionState.error`; authentication, role, database, and unexpected failures still propagate to the app error boundary.
- There is no neutral add-on checkout/request route yet. The FeatureGate therefore supports an explicit optional CTA and does not misrepresent Konsignation as a BUSINESS tariff upgrade; adding commercial purchase flow remains a later tariff/billing phase.
- No product-facing agent/LLM integration exists. Agent-tool parity for organization switching or entitlement context would be a new product capability and is intentionally outside Prompt 2 rather than silently introduced by the shell phase.

---

## Prompt 1 — Additive Domain Foundation and Feature Entitlements

### Baseline
- Prompt 1 starts from clean commit `5fdfee1 docs: define internal product and beta rebuild strategy`; no pre-existing worktree changes were present.
- The task explicitly authorizes additive schema/migration work, small central domain modules, tests, documentation, and a final commit.
- Existing movement/allocation/import/RLS modules remain authoritative. New models will reference these modules instead of replacing them.

### Working architecture rule
- Prefer a small pure interface for policy modules (entitlement activity, condition mapping, recurrence, fee validity) and keep Prisma adapters outside their pure implementation where possible.
- New relational foundations may coexist with existing free-text snapshots. Relations are nullable during transition; old strings stay readable and writable by current production logic.

### Additive model decision
| Area | Existing model extension | New models / enums | Compatibility |
|---|---|---|---|
| Partners | Nullable partner references on `Purchase` and `ConsignmentLot` | `BusinessPartner`, `BusinessPartnerRole`, role enum | `vendor` and `partnerCompany` remain required snapshots; no backfill is forced. |
| Platform accounts | Nullable account reference on `Sale` and `Credential`; `Platform` gains relations | `MarketplaceAccount`, account-type enum | Existing platform rows and sales remain valid without an account. Secrets remain in `Credential`. |
| Payout/payment accounts | Nullable account references on purchase, sale, expense, marketplace account | `PayoutAccount`, account-type enum | Existing `paymentMethod` and `payoutRecipient` strings remain readable snapshots. |
| Condition | Nullable normalized condition on stock/current inventory/return lines | `ItemCondition` enum | Legacy strings map through a pure module; unknown values remain unmapped, never coerced. |
| Expenses | Organization relations only | `ExpenseCategory`, `Expense`, `ExpenseRecurrenceRule` plus status/interval enums | One-time expense = no recurrence row; imports link through `SourceReference` target types. |
| Supplier returns | Relations from purchase, purchase line, inventory position, movement and user | `SupplierReturn`, `SupplierReturnLine`, status enum; new document kind | Customer `Return` remains unchanged. Stock effects later use the existing movement module. |
| Tasks | Existing `Task.assigneeId` stays as legacy primary hint; add nullable scope and progress | `TaskAssignment`, `TaskChecklistItem`, `TaskActivity` plus scope/role enums | Existing tasks remain readable without assignment rows. One-primary and no-duplicate invariants are enforced in the module and SQL. |
| Fees | `Platform` and account relations | `FeeSchedule`, `FeeRule` and origin/VAT enums | Existing `defaultFeePercent` and sale fee snapshots remain unchanged. |
| Entitlements | Subscription tier remains untouched | `FeatureEntitlement` plus source/status enums | Multiple grants preserve history; access is time/status evaluated and never deletes domain data. |

### Migration safety
- All new tenant models carry `organization_id`, indexes, `ENABLE/FORCE ROW LEVEL SECURITY`, and tenant/bypass policies.
- New columns on existing tables are nullable except safe task progress/defaults; no legacy row must be rewritten.
- Foreign keys use `SET NULL`, `RESTRICT`, or `CASCADE` according to history ownership; posted/historical documents do not cascade-delete from configurable master data.
- SQL checks cover positive quantities, task progress, recurrence intervals, date ranges, and non-negative fee/expense amounts.

---

## Prompt 0 — Internal Product Constitution and Beta Rebuild Planning

### Baseline
- `git status --short` and `git diff --` were clean before edits.
- Recent history shows the completed inventory-domain phases, then public redesign work; `87c4a6a MCP` is the latest commit.
- Existing planning files are tracked project documentation. Prompt 0 updates them only as working notes and will not alter application code.
- Codebase memory was indexed in non-persistent mode. Its architecture scan confirms established core seams: organization access (`requireOrg`), auditing (`writeAuditLog`), inventory movement, document numbering, calculations, tables, actions, and reporting.
- Current architectural hotspots include `requireOrg` (75 inbound), `writeAuditLog` (45), `applyInventoryMovement` (11), and `reserveDocumentNumber` (7). They are core modules to extend, not replace.

### Tool Availability
- `codebase-memory-mcp` and Chrome DevTools are available. The repository was indexed because it was not known to be indexed.
- `next-devtools` is available but no Next.js 16+ MCP server exists. `package.json` reports Next.js 15.5.20; no upgrade is justified for this phase.

### Planning Decisions
- The roadmap sequences shared read/table seams before UI rollout, isolates entitlement enforcement from pricing decisions, then generalizes commercial references, dashboard intelligence, distinct return operations, and import coverage.
- The table-view matrix makes the user-required interaction contract explicit per module rather than forcing an identical view across all modules.
- The temporary architecture report was created outside the repository at `C:\\Users\\WN0022~1\\AppData\\Local\\Temp\\architecture-review-20260713-091317.html` and opened for inspection. No report artifact was written to the worktree.

---

## Requirements
- Reconstruct the completed Prompt A/B state without reimplementing it.
- Validate documentation, Next.js structure, real browser behavior, responsive layouts, errors, accessibility, and design-direction consistency.
- Repair only verified defects and obvious quality issues.
- Create `docs/public-ab-validation.md`, run all project gates, and commit the result.
- Do not begin Prompt C or the full Prompt D auth redesign.

## Research Findings
- Git baseline was clean before edits.
- Recent commits identify Prompt A as `de5090c Document public redesign direction` and Prompt B as `3587119 Implement public shell foundation`.
- Prompt B documents a shared public shell, legal/about routes, auth shell, and landing-page anchors while explicitly deferring the full landing page, pricing integration, FAQ/trust/chat, and final auth redesign.
- The project pins Next.js `15.5.20`; native Next.js runtime MCP support described by next-devtools requires Next.js 16+, and framework migration is out of scope.
- `chrome-devtools` and `next-devtools` are available in the current session. `codebase-memory-mcp` is not exposed as a callable tool.
- The attempted `next-devtools` runtime index call was rejected by the platform usage-limit gate before reaching the tool. No runtime data was returned.
- `agent-browser` is not installed as a CLI in the environment.
- The public routes are implemented directly under the root app layout; login and register intentionally wrap themselves in `PublicAuthShell` rather than relying on an `(auth)` layout file.
- `components/marketing/marketing-shell.tsx` centralizes the public header, footer, page header, legal shell, and auth shell behind a compact interface, providing useful locality for Prompt B fixes.
- The landing page still contains the generic hero/cards/testimonials composition and wording identified by Prompt A, but Prompt B explicitly deferred replacing it to Prompt C. These are not validation defects by themselves.
- The desktop public navigation is intentionally hidden below the `lg` breakpoint; mobile retains brand, theme toggle, login from `sm`, and the register CTA. Browser validation must determine whether this causes crowding at 390 px or missing required mobile navigation.
- Verified routing defect: middleware only classified `/`, `/login`, `/registrieren`, and `/pricing` as public. The new `/about`, `/impressum`, `/datenschutz`, and `/agb` routes therefore redirected anonymous visitors to login.
- Verified mobile contract defect: at widths below 640 px the header removed the login link despite the site-map requirement for logo, login, and registration CTA.
- Icon audit: the public shell consistently uses linear Lucide icons. No mixed icon library or decorative icon substitution was found; the better-icons CLI is not installed, so no external icon retrieval is necessary for the scoped repair.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Validate the existing Public Shell as a module at the shared marketing-shell seam | Header, footer, legal pages, and auth framing should gain locality from one shared interface. |
| Use the documented Transit Ledger direction as the visual review baseline | This prevents generic personal preference from expanding the Prompt B scope. |
| Keep legal placeholders if clearly disclosed | Prompt B intentionally avoids fabricated legal text; final operator-provided content is outside this validation. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Source documents display mojibake in the current PowerShell output | Treat file contents structurally and inspect browser rendering separately before deciding whether source encoding is defective. |
| `app/(auth)/layout.tsx` does not exist | Not an error: both auth pages directly use the shared `PublicAuthShell`, matching the documented implementation. |
| `next-devtools` runtime call blocked by session usage limit | Do not retry or route around the gate; use static Next.js inspection and the independently requested chrome-devtools browser diagnostics. |
| Public/legal routes treated as protected | Add all Prompt B public routes to the middleware public-route set. |
| Mobile login action hidden | Keep an accessible icon-only login action below `sm` and shorten only the visible registration label on mobile. |

## Resources
- `docs/public-redesign-audit.md`
- `docs/public-design-direction.md`
- `docs/public-site-map.md`
- `docs/public-shell-implementation.md`
- `components/marketing/marketing-shell.tsx`

## Visual/Browser Findings
- Chrome DevTools validation on the local Next.js 15.5.20 server (`http://localhost:3002`) confirms that `/`, `/pricing`, `/about`, `/impressum`, `/datenschutz`, `/agb`, `/login`, and `/registrieren` all render their expected headings with HTTP 200 responses. The protected-route repair is effective for anonymous browser navigation.
- No console errors, hydration warnings, failed requests, 404s, or failed assets were observed across those public routes. The only console output was expected Turbopack Fast Refresh logging.
- At 1440, 1280, 768, and 390 px the landing page has no horizontal overflow. At 768 px the desktop link group correctly collapses while the Login and Register controls remain visible; at 390 px Login is a named icon control and the short `Starten` CTA remains visible.
- Visual screenshots at 1440 and 390 px show a readable, intact header, hero, CTAs, and workflow illustration. The existing generic landing-page composition remains intentionally deferred to Prompt C.

## Prompt C Findings (2026-07-12)
- Prompt C begins from clean commit `1a971c8`; no user worktree changes were present.
- The current landing page is a single large server component with generic hero, stat strip, equal feature cards, placeholder testimonials, and a small pricing CTA. No tests directly target its presentation; browser and accessibility checks are the appropriate primary evidence for this visual-only behavior change.
- `TIERS` in `lib/billing.ts` is the pricing source of truth. The landing page can render a concise preview directly from it without changing billing actions or the existing `/pricing` route.
- Existing shadcn Button primitives, Public Shell tokens, `Reveal`, and centralized header/footer provide the production foundation. Prompt C should deepen the landing-specific visual language without destabilizing legal/auth pages.
- Better Icons confirms a consistent Lucide set for the product flow: `route`, `package-check`, `rotate-ccw`, `coins`, and `shield-check`.
- Form motif answers: narrative role = operational journey; viewing distance = laptop/phone; visual temperature = calm precision; capacity = dense but scannable; unique motif = one continuous movement rail with ledger stamps and return loop.
- First Chrome render at 1042 px exposes all ten required sections, one H1, five native FAQ disclosures, correct anchor targets, and the expected register/login/pricing paths. No console errors, hydration warnings, failed requests, missing assets, or horizontal page overflow were present.
- Desktop and mobile hero screenshots confirm the intended high-contrast editorial hierarchy and code-native isometric board. Mobile keeps all header actions and CTAs readable; the board intentionally enters below the copy but needs a final narrow-screen framing check.
- Browser Trace setup reached a managed local Chrome session, but the skill's `start-capture.mjs` cannot spawn the Windows npm `browse.cmd` shim (`spawn browse ENOENT`). The Chrome DevTools network/console/performance capture remains the primary QA evidence; do not repeatedly retry the incompatible wrapper.
- `next-devtools` runtime indexing confirms no MCP endpoint on Next.js 15.5.20. This is the documented version limitation, not a page error.
- The four-viewport geometry audit passed at 1440, 1280, and 768 px with no element or document overflow. At 390 px it exposed only the transformed hero board extending beyond its clipped stage; the mobile rule now removes Y rotation and the min-height/aspect-ratio expansion so the board uses the available width.
- Question-console submit state and native FAQ disclosure both work at 390 px. The Browser Trace firehose captured same-document anchor navigation, a full reload, complete 200 responses, lifecycle completion, and no exceptions.
- Final TypeScript, ESLint, and all 117 Vitest tests pass. The sandboxed production build reaches optimized compilation but fails only while fetching the three existing Google Fonts; the required network-enabled rerun was rejected by the platform usage limit before execution.
- Continuation run: network-enabled `npm run build` now completes successfully, including compilation, type/lint validation, all 26 static pages, optimization, and build traces.
- Final 390 px Chrome recheck confirms the mobile board fix: board bounds are 11–380 px within a 390 px viewport, all five station labels remain inside the viewport, no board descendants overflow, document width remains 390 px, every request returns 200, and the console is clean. The final screenshot also confirms both ledger tickets are visible rather than clipped.

## Prompt D Findings (2026-07-12)
- Prompt D starts from clean commit `88b3bf2`; no user worktree changes were present.
- Login and Register already share `PublicAuthShell`. Their functionality is separated cleanly into the existing NextAuth client flow and server actions, so the redesign can remain presentation-only.
- Login already handles generic credentials errors and the two 2FA states explicitly. Register uses server-side Zod validation, a 12-character password minimum, and a shared organization-fields component.
- The current auth shell has the right product vocabulary but still resolves as a conventional illustrated panel beside a floating form card. The redesign should turn it into a more specific Transit Gate and access-manifest composition.
- The required route graph already exists: both pages link to the landing page and to each other. Browser QA must verify visibility and keyboard/mobile usability rather than invent new destinations.
- shadcn is configured and the existing Button, Input, Label, Alert, Select, and Separator primitives cover the production UI needs; no new registry component is required.
- Context7 and codebase-memory-mcp are not exposed as callable tools in this session. Direct code inspection supplies the needed context without blocking the work.
- The repository uses Next.js 15.5.20. As in Prompt C, next-devtools may report no runtime MCP endpoint because that integration targets Next.js 16+; this is a tooling limitation, not an app defect.
- Initial mobile Lighthouse scored Accessibility 96 because the light-theme submit button used white on Transit Teal at 3.94:1. The auth submit text is now explicitly dark for WCAG AA contrast; unrelated robots/llms discovery failures come from missing project-wide files and are outside the two-route redesign scope.
- Browser Trace's managed Browse launch cannot enumerate the Windows process under the current sandbox (`Get-CimInstance: Access denied`) and remains uninitialized. After one attempt, continue with Chrome DevTools network/console, screenshots, responsive emulation, Lighthouse, and performance trace rather than repeatedly retrying the blocked launcher.
- Full TypeScript, ESLint, and all 117 Vitest tests pass. The sandboxed Production Build reaches optimized compilation and fails only on blocked downloads for the existing Inter, JetBrains Mono, and Space Grotesk setup; the final shipping command reruns it with approved network access before committing.

## Prompt E Findings (2026-07-12)
- Prompt E starts from clean commit `7dc8113` on `phase-1/inventory-datamodel`, not main/master.
- The public system is already split into `LandingPage`, shared Marketing Shell, Auth Shell, Reveal, Question Console, pricing components, and direct public/legal routes. Prompt E can remain a focused polish pass.
- Huashu motion guidance points to physical continuity, expo-out settling, small directional reveals, one memorable peak, deliberate pauses, and strict reduced-motion coverage rather than uniform fades or permanent animation.
- ce-polish helper scripts are Bash-only and invoke WSL in this Windows environment; WSL has no installed distribution. The project is directly identifiable as Next.js 15 with `package-lock.json`, `npm run dev`, and default port 3000, so follow the referenced recipe manually.
- ce-test-browser selects the host-native Chrome DevTools driver for the entire run. The requested scope maps to `/`, `/login`, `/registrieren`, `/about`, `/impressum`, `/datenschutz`, `/agb`, and shared navigation/footer interactions.
- Consistency defect: the visible brand is `StoargeX`, but Landingpage copy repeatedly says `StorageX`. Public metadata and Auth use `StoargeX`; polish should normalize visible public copy to that established wordmark.
- Mobile navigation defect: the single-page anchor navigation is completely hidden below `lg`. Login/Register remain reachable, but mobile users cannot directly reach Workflow, Features, Pricing, About, Question, or FAQ.
- Question Console is honest and functional but remains a plain textarea plus placeholder acknowledgment. It needs a small context-selection → question → prepared-receipt flow to feel like an integrated operational checkpoint without pretending to have an AI backend.
- Motion inconsistency: Reveal uses generic `ease` fade-up, while Landing/Auth use expo-style movement. Hero and Auth route indicators loop forever, conflicting with the stated controlled-motion goal. Normalize easing and cap route animations.
- Footer and legal/about pages still look like the earlier shell foundation: correct but visually flatter than the Landing/Auth system. Shared transit rail, back-navigation, surface rhythm, and CTA copy can close the gap without rewriting page content.
- Footer CTA copy says `Registrieren` while the rest of the public system says `Organisation gründen`; normalize the action language.
- Existing shadcn `Sheet`, Button, Input/Label/Alert primitives cover the mobile-navigation and form polish needs. No dependency or registry addition is necessary.
- The preferred port 3000 is occupied but did not answer HTTP probes. To avoid mutating an unknown process, the Prompt E QA server runs on port 3005.
- next-devtools confirms no runtime MCP endpoint on the healthy port-3005 server, matching the documented Next.js 15 limitation. shadcn audit requirements are satisfied so far: existing dependencies only, no remote image changes, and targeted TypeScript/ESLint are green.
- Chrome mobile QA confirms the header fits at 390 px with brand, theme, menu, Login, and Start controls. The Sheet exposes all six anchor destinations plus Register, Login, and Datenschutz in a correctly labeled dialog.
- The question flow works end to end at mobile width: selected `Retoure` becomes pressed, an example populates the textarea and counter, submit enables, and the result becomes a polite live region with preserved context, edit control, and Register path.
- `/login`, `/registrieren`, `/about`, `/impressum`, `/datenschutz`, and `/agb` all render their expected H1 and core content without horizontal overflow. Auth exposes the expected fields; content pages retain Footer and visible Landingpage back-navigation.
- Exact 390 px Legal geometry passes: document width equals viewport width, all visible header/Footer controls remain within 374.4 px, and the legal article fits from 16–374.4 px.
- Chrome DevTools screenshot capture became intermittently stuck after interactive Sheet/navigation work. Two isolated screenshot calls were terminated; further screenshots were stopped. Accessibility snapshots, computed geometry, Lighthouse, and performance capture remain healthy and sufficient.
# Prompt 3 — Unified Operational Table System

## Baseline and architecture direction
- Prompt 3 starts from clean commit `f2f85bb feat: rebuild internal app shell and navigation` on `phase-1/inventory-datamodel`; there are no pre-existing worktree changes.
- The sequential prompt explicitly authorizes implementation, tests, documentation, and the exact final commit while limiting full module migration to `/produkte`.
- The table module will be deep at the shared query/view/selection seam: callers provide declarative domain configuration and rows, while parsing, normalization, preset application, persistence validation, selection semantics, and filtered-export projection stay local to the shared implementation.
- Product-specific columns, Prisma query construction, reference-safe mutations, import mapping, and detail content remain outside that seam so the common module does not become a domain-blind universal table.
- The existing feature branch is retained because Prompt 3 builds directly on committed Prompt 0–2 work; no new branch or worktree is needed.
- No schema change is assumed. Discovery must prove that existing settings/preferences cannot support saved views before any Prisma work is considered.

## Initial repository evidence
- `/produkte` is currently a server-rendered `findMany` plus a fixed seven-column table. It already has create/edit dialogs and delete action, but no table workspace, import/export bar, filters, pagination, saved view, bulk action, or detail drawer.
- Existing reusable table pieces are intentionally shallow: `CompactTableShell` provides simple local search/view/bulk framing and `DetailDrawer` provides the drawer shell. Prompt 3 should replace/deepen the former mechanics while reusing the latter presentation primitive.
- The repository already depends on `xlsx` and has `/api/export/[table]`, `ImportExportBar`, `lib/import-export.ts`, `importRowsAction`, `ImportBatch`, and `SourceReference`; templates and product support must extend these paths, not create another engine.
- `Product` already contains category, brand, EAN, standard purchase price, size, image URLs, active state, and organization ownership. Product filtering/projection can therefore be additive application code without schema work.
- The product matrix default is `Aktiver Katalog`, with unused/low-stock/archived views; brand, size, image count, and usage counts are optional/detail candidates. The prompt's explicit standard/optional column list takes precedence where it is more specific.
- The app uses Next.js 15.5.20, Prisma 6.19.3, React 19, Zod 4, Radix/shadcn-style primitives, Lucide, and Vitest; no table framework dependency exists or is required for this reference implementation.

## Product and import seam findings
- `Product` has no archive/active flag. Prompt 3 does not authorize a schema phase, so the reference presets will use facts the current model can prove (`catalog`, `used`, `unused`, `low-stock`) instead of pretending an archive lifecycle exists. Archive/unarchive remains a later additive domain decision.
- Current product deletion calls `delete` directly. Existing foreign keys will reject referenced products, but the action does not preflight or translate that safely. Prompt 3 will add a tenant-scoped usage count precheck and controlled error; referenced products are never deleted.
- Existing product creation/editing omits `brand` and `size` even though the model has both. These fields are required for the requested filters/optional columns and can be added to the existing form/action without schema work.
- Server-side product search is already case-insensitive but fixed at 500 rows. The reference should use URL-restorable server query state plus `count`/`skip`/`take` pagination because the catalog is unbounded and a table library/virtualizer is unnecessary for page-sized results.
- The current `CompactTableShell` persists only a CSS view name in unscoped localStorage. The new preference adapter will namespace by organization, user, and table; validate stored data; persist density/visible columns/named views; and keep filters/sort in the URL so they remain shareable.
- `ImportExportBar` already parses CSV/XLS/XLSX, detects headers, auto-maps columns, runs dry runs, shows row errors, provides conflict review for migration imports, and displays a summary. The missing layer is a first-class template contract/download plus product table support.
- The export route validates session membership and then uses `tenantDb(activeOrgId)`. It forwards only a subset of each page's filters and currently has no products case. Prompt 3 will centralize product filter parsing and reuse it in both page and export so active-filter export cannot drift.
- Import commit creation already writes `ImportBatch` and `SourceReference`. Adding products to the same `TableKey`, request schema, planner, commit switch, and source-reference creation preserves provenance without a second engine.

## Shared UI and tenant findings
- `tenantDb(organizationId)` wraps every Prisma operation in a transaction with `app.current_org_id`, so page/export queries are RLS-scoped even without repeating `organizationId` in every `where`. Mutation preflight and bulk resolution still need explicit tenant-local queries through this adapter.
- `requireOrg()` returns both the user id and organization id, which is enough to namespace browser preferences as `organization + user + table` without exposing session data to another tenant.
- Existing `sx-datatable` CSS already provides sticky headers, zebra rows, selected/low row states, sticky first columns, and responsive scroll framing. The new workspace can extend these established classes instead of introducing a second visual table language.
- Radix AlertDialog and Checkbox are available through the installed `radix-ui` package even though local primitives do not yet exist. Thin shadcn-style primitives are justified because both safe confirmation and accessible tri-state row selection have multiple table call sites.
- No existing tests cover product actions or a product table. New tests should target the pure operational-table interface, product query/config parser, import template contract, and product action behavior with mocked tenant adapters.
- Global CSS is very large and includes public marketing layers. Prompt 3 changes should add only a compact internal table block near the existing data-table section; unrelated public styles remain untouched.

## Implemented Prompt 3 contracts
- The operational-table module owns validated scoped persistence and explicit/all-result selection. The React workspace owns browser adaptation and controls; product rendering remains in `components/products/product-table.tsx`.
- Product filters, presets, pagination, sorting, bulk resolution, and export all share `parseProductTableQuery`/`buildProductWhere`. This is the key anti-drift seam for active-filter exports.
- Select-all uses a semantic descriptor (`all` plus exclusions), not a client-provided list of every matching ID. The bulk action reconstructs the filter and resolves IDs through the tenant client before updating, caps the operation at 5000, and audits the resolved IDs.
- Product deletion now preflights purchase-line, inventory-position, and sale-line references and returns a controlled result. Database constraints remain the final safety net.
- Product import is a new table definition and commit branch inside the existing migration engine. Existing name+variant pairs produce blocking conflicts; committed new products create the existing `ImportBatch` and `SourceReference(PRODUCT)` records.
- Template downloads are authenticated and membership-checked. CSV is semicolon/BOM compatible; XLSX contains an `Import` sheet and a separate `Spaltenbeschreibung` sheet.
- No Prisma schema or migration file is changed. The current product model is sufficient for the reference slice; archive lifecycle remains deliberately deferred.

## Prompt 3 reopened gate evidence (2026-07-13)
- With restored external access, `npm run integrity:check` passed all 13 inventory, allocation, tenant-link, document-number, and movement-replay invariants against the configured Supabase database.
- The sandboxed build reproduced only the known Google-Fonts network failure. The approved network-enabled rerun completed compilation, type/lint validation, all 26 static pages, build traces, and the route manifest successfully; `/produkte` builds as a dynamic route at 13.3 kB route size and 326 kB first-load JS.
- The first Chrome navigation reached `/produkte`, but the sandboxed dev-server process could not reach Supabase and rendered the Next.js Prisma error overlay. This is the same network boundary already disproved by the approved integrity run, so browser QA requires restarting the dev server with approved network access rather than changing application code.
- The network-enabled dev server is healthy, but the reused Chrome profile carries stale auth/navigation state: the first reload ended on `chrome-error://chromewebdata`, and direct `/produkte` navigation reported `ERR_TOO_MANY_REDIRECTS`. Browser QA should continue in a fresh isolated Chrome context and authenticate with the repository's documented development account if available.
- Code and server-log inspection explain the loop without a Prompt-3 regression: the stale JWT is treated as signed in by middleware, while `requireOrg()` can no longer resolve its active membership from the database, producing `/produkte -> /login -> /dashboard -> /login`. A fresh isolated context removes this invalid session boundary.
- Fresh isolated Chrome context `prompt3-qa` loads `/login` successfully with the expected email/password fields, legal links, no redirect loop, and the Next.js app surface. Repository search found no documented development credentials, so authenticated `/produkte` QA requires the user to sign in through the visible browser; credentials must not be requested or stored by Codex.
- Human sign-in succeeded and the isolated context reached `/dashboard`. The configured database has not applied the already-committed Prompt-1 beta-domain migration (`feature_entitlements` table and `sales.marketplace_account_id` are absent), which breaks Dashboard reporting but does not prevent `/produkte` from rendering because the shell's entitlement lookup degrades to disabled.
- Authenticated `/produkte` renders 216 tenant-scoped results with all Prompt-3 controls in the accessibility tree: templates, CSV/XLSX export, import, product create, four presets, case-insensitive search/filter form, date ranges, page sizes, columns, density, saved views, tri-state selection, sortable headers, row actions, and 9-page pagination.
- Chrome console on authenticated `/produkte` contains only Fast Refresh logs: zero warnings, errors, or hydration messages. All 34 requests in the scoped navigation are successful HTTP 200 responses.
- Desktop geometry at requested 1440 px (Chrome content viewport 1442x828) has no document-level horizontal overflow. The table owns its required horizontal scroll (`1114px` client vs `1666px` content) and bounded vertical scroll (`548px` client vs `1140px` content); the desktop sidebar remains visible.
- 1440 px visual evidence is stored in ignored build output at `.next/prompt3-products-1440.png`. Computed styles confirm sticky header cells (`position: sticky; top: 0; z-index: 30`) and sticky product identity (`left: 40px; z-index: 30`); the main content stays between the 240 px sidebar and viewport edge.
- Requested 1280 px check currently fails the no-document-overflow contract: Chrome content viewport is 1282 px while `documentElement.scrollWidth` is 1363 px. The main region itself ends at 1266 px and the table correctly scrolls internally (`954px` client vs `1666px` content), so a control outside the table is imposing the extra 81 px and requires targeted diagnosis.
- Overflow diagnosis identifies the exact source: the page-size/apply control group begins at 1148 px and ends at 1363 px. Its no-wrap flex row (`25 / Seite` plus `Anwenden`) exceeds the available final grid track; table descendants are correctly clipped by their scroll container and are not the document-overflow cause.
- The responsive filter-grid fix changes 1280 px to three equal tracks and lets its action group wrap. Retest passes: document width 1266 px within the 1282 px content viewport, action group contained at 923–1246 px, table still independently scrollable, and console empty after HMR. Evidence: `.next/prompt3-products-1280.png`.
- Tablet check at requested 768 px passes: Chrome content viewport 770x828, document width 754 with no overflow, two-column filter grid, desktop sidebar hidden, mobile navigation trigger visible, header contained, and table scroll confined to a 690 px container.
- Tablet viewport evidence saved at `.next/prompt3-products-768.png`; fresh accessibility snapshot confirms breadcrumbs, all table controls, row actions, and the mobile navigation trigger remain exposed with accessible names.
- Mobile navigation interaction passes at 768 px: trigger opens the named `App-Navigation` modal with the complete grouped route list, Escape closes it, and focus returns to `Navigation öffnen`.
- Chrome window resizing enforces a 502 px minimum content width when asked for 390 px; that intermediate width still has no document overflow and a one-column filter form. Exact phone verification must use DevTools viewport emulation (`390x844x1,mobile,touch`) rather than window resize.
- Exact 390x844 mobile emulation passes: document width equals 390 px, main content is contained, filters use one 366 px column, and the table confines its 1666 px content to a 365 px horizontal scroller. Off-viewport preset/header actions belong to explicit horizontal-scroll regions; no interactive control creates document overflow.
- Mobile evidence saved at `.next/prompt3-products-390.png`. Console remains free of warnings/errors/hydration messages after responsive HMR; only Fast Refresh lifecycle logs are present.
- Mobile detail drawer is functionally healthy. Chrome's coordinate-based click command twice failed on the horizontally scrolled table action despite reporting success; a diagnostic DOM click on the exact visible button opened the standard Radix dialog. The drawer fills 390x844 and exposes product identity, catalog fields, usage counts, images, and history. This isolates the anomaly to the automation click driver rather than application code.

---
### Mobile detail drawer focus return (2026-07-13)
- Closing the full-screen product detail drawer with `Escape` removed the dialog, restored `body` pointer events, and returned focus to the originating `Details` button.
### Product table controls at 390 px (2026-07-13)
- The mobile toolbar exposes template download, CSV/Excel export, import, column control, and saved-view controls without document overflow.
- A scripted template-button activation was issued; portal state needs a follow-up check because the dialog was not present in the same synchronous evaluation tick.
### Import-template dialog (2026-07-13)
- The product template dialog is keyboard reachable and exposes empty and example downloads in both CSV and XLSX.
- It renders the required column contract inline: required markers, accepted formats, and descriptions for name, variant, brand, category, EAN, default purchase price, size, and images.
- `Escape` closes the dialog.
### Template/export endpoints and import entry (2026-07-13)
- Authenticated browser fetches returned HTTP 200 with attachment headers for empty CSV template (65 bytes), example XLSX template (20,326 bytes), and filtered product CSV export (16,015 bytes).
- The product import dialog exposes a file input and the existing staged flow; `Dry Run prüfen` and final import remain safely disabled before a file is selected.
### Row selection (2026-07-13)
- Selecting the first product row through its semantic checkbox updates `aria-checked` to true and renders the `1 ausgewählt` bulk-selection state.
- Import-dialog `Escape` close was also verified before the selection flow.
### Safe bulk categorization entry (2026-07-13)
- With one row selected, `Kategorie zuordnen` opens a confirmation workflow that explicitly states the server revalidates the result set.
- Without choosing a target category, `Zuordnung prüfen` is disabled; the dialog was closed with `Escape`, so browser QA made no product mutation.
### Page-wide selection (2026-07-13)
- Header selection checks all 25 rows on the current page, shows `25 ausgewählt`, and offers the explicit escalation `Alle 216 Treffer auswählen` for the full filtered result set.
- `Auswahl aufheben` clears the selection without mutation.
### Full result-set selection (2026-07-13)
- Escalating current-page selection to the full filtered result set changes the state to `216 ausgewählt`.
- Clearing selection returns all visible semantic checkboxes to unchecked and removes the bulk-selection state.
### Density persistence (2026-07-13)
- Switching the product table from comfortable to compact density reduced the first-row height from about 48 px to about 40 px.
- The preference persisted in organization- and user-scoped local storage under the products table v1 key, alongside visible-column and saved-view state.
### Column-control automation note (2026-07-13)
- The column-control button is present in the mobile toolbar. Direct DOM activation did not expose its popup to the automation tree, so this control will be retried with a fresh accessibility snapshot and native DevTools click.
### Column and view control semantics (2026-07-13)
- A fresh accessibility snapshot exposes `Spalten` as an expandable menu button, `Dichte` as a named combobox with comfortable/compact options, and `Ansicht speichern` as an expandable dialog button.
### Column selection menu (2026-07-13)
- Native DevTools activation opens the named column menu and reports the expected defaults (product, variant, category, brand, usage) plus optional EAN, default purchase price, size, images, and changed-at columns.
### Optional-column persistence (2026-07-13)
- Selecting optional EAN adds the `EAN` header to the live table and persists `ean` in the scoped visible-columns preference.
- Comfortable density restoration returned row height to about 48 px.
### Saved-view dialog (2026-07-13)
- `Ansicht speichern` opens a named dialog stating that filters, sorting, columns, and density are stored for the organization.
- Save is disabled until a name is supplied; `Escape` closes the dialog. No test view was persisted.
### Search and sort semantics (2026-07-13)
- Lowercase `pattfield` search returned 49 matching products whose displayed brand is `Pattfield`, confirming case-insensitive operational search.
- The product header exposes direction-aware links and accessible labels; active name ascending offers `Produkt absteigend sortieren`, while other sortable columns offer ascending.
- Exact 390 px search results retain zero document overflow.
### Descending sort execution (2026-07-13)
- Activating the name header changed the URL to `sort=name&direction=desc` and inverted the accessible action to `Produkt aufsteigend sortieren`, confirming bidirectional state.
### Pagination (2026-07-13)
- The filtered 49-result search paginates correctly: page 2 renders 24 rows with `26–49 von 49 Treffern`, enables previous, and disables next.
### Combined filters (2026-07-13)
- Combining brand `Pattfield` with category `Garten & Terrasse > Hand-Gartengeräte > Grasscheren` yields exactly one row, and both selected values round-trip through the URL and controls.
### Product-specific presets (2026-07-13)
- The reference module exposes product-specific presets `Katalog`, `Verwendet`, `Unbenutzt`, and `Niedriger Bestand`; the active preset is identified with `aria-current=page`.
### Preset execution (2026-07-13)
- Activating `Verwendet` round-trips as `preset=used`, marks that preset current, and returns 191 matching products with normal pagination.
### Browser state cleanup (2026-07-13)
- Restored the authenticated QA account to canonical `/produkte`, comfortable density, default columns, no saved test views, no dialog, and no row selection.
### Chrome form-control issue (2026-07-13)
- Final Chrome issue audit identified two form controls with neither `id` nor `name`; these correspond to the density and saved-view selects and should be named to keep the browser issue panel clean.
### Named table controls fix (2026-07-13)
- Added stable table-key-scoped `id`/`name` attributes to density and saved-view selects, plus a name for the saved-view input.
- After reload, Chrome reports no console messages or issue-panel findings on authenticated `/produkte` at exact 390 px.
### Final route health (2026-07-13)
- Final authenticated 390 px reload produced 34/34 successful network requests (all HTTP 200), including the document, app chunks, fonts, and favicon.
- The operational search field accepts programmatic keyboard focus by its semantic name.
### Keyboard focus visibility (2026-07-13)
- Pressing `Tab` from product search advances to the category filter in DOM order.
- The destination matches `:focus-visible` and receives a 1.6 px teal outline, confirming visible keyboard focus.
### Final quality gates (2026-07-13)
- `prisma validate`: pass.
- `prisma generate`: pass after stopping the QA dev server that held the Windows engine DLL open.
- TypeScript (`tsc --noEmit`): pass.
- ESLint: pass.
- Vitest: 30 files and 214 tests pass.
- `integrity:check`: 13 checks pass with zero violations.
- Next.js 15.5.20 Turbopack production build: pass; 26 static pages generated and `/produkte` reports 13.3 kB route size / 326 kB first-load JS.
- `git diff --check`: pass; only Git's existing LF-to-CRLF working-copy notices are emitted.
## Persistent QA account discovery (2026-07-14)

- The worktree was clean at task start.
- The account must be created through existing auth and tenant seams; no authentication bypass or tracked plaintext secret is acceptable.
- Prior Prompt-3 QA established that the configured database was missing Prompt-1 entitlement schema at that time, so schema availability must be rechecked before claiming full feature access.
- Credentials authentication verifies Argon2 password hashes and requests a TOTP only when `User.totpEnabled` is true.
- A product-policy conflict exists: middleware redirects every `OWNER` or `ADMIN` membership with `totpEnabled=false` into 2FA setup. Therefore a normal full-administration account cannot simultaneously remain 2FA-free under the current role policy; discovery must distinguish full product entitlements from administrative organization permissions before provisioning.
- Current known feature gating has one additive key, `CONSIGNMENT`; the legacy `BUSINESS` subscription tier also enables it. Credentials login itself does not require TOTP while `totpEnabled=false`.
- `MEMBER` is the highest role exempt from mandatory 2FA. It can mutate all operational domains (products, purchases/imports, stock, sales, returns, shipping, debts, tasks, consignment) but cannot perform ADMIN/OWNER-only organization, team, credential-vault, catalog/tax, destructive debt/shipping, GDPR, or billing operations.
- No existing seed/provision/test-account script or package command exists, so provisioning needs either a one-off untracked command or a deliberately added reusable script. The safer default is an untracked one-off operation because the user did not request a repository feature or commit.
- The repository contains the additive `20260713100000_beta_domain_entitlements` migration. The configured datasource is the external Supabase `postgres/public` database previously used for QA, but sandbox networking cannot reliably query its migration status.
- Approved read-only migration status confirms two unapplied migrations: `20260709100000_product_brand` and `20260713100000_beta_domain_entitlements`. Account provisioning must not claim database-backed add-ons or apply schema changes implicitly.
- An isolated organization can still receive full current route-tier access through `subscriptionTier=BUSINESS`; the existing entitlement evaluator treats BUSINESS as legacy consignment access when no grant is available.
- `.env*` is ignored except `.env.example`, so a reusable `.env.qa.local` credential file can remain local and untracked. This is preferable to putting the password in source, planning notes, or shell history.
- Registration currently creates an OWNER and therefore immediately triggers mandatory 2FA; it cannot be reused unchanged for this account. Its transaction pattern and neutral parts of the starter-data seed can still be mirrored through RLS bypass.
- Organization, platform, carrier, tax-rate, and select-option records have suitable organization-scoped unique keys for idempotent upserts. The QA organization should use neutral platform/account labels rather than copying the registration action's personal legacy examples.
- The local credential file and idempotent provisioning helper are both covered by existing ignore rules (`.env*` and `/.tmp-*`). The helper passes `node --check`; tracked source remains untouched apart from the required planning notes.
- Provisioning succeeded for `qa-codex@storagex.test`: TOTP false, isolated organization `storagex-codex-qa`, BUSINESS tier, MEMBER role, and consignment access via the existing BUSINESS fallback because the entitlement table is not deployed.
- The UI uses the standard Auth.js `signIn("credentials", { redirect: false })` client flow. A safe verification can reproduce the same first-party CSRF/callback/session chain without adding browser libraries or exposing the password.
- The exact client contract posts URL-encoded credentials plus CSRF token to `/api/auth/callback/credentials` with `X-Auth-Return-Redirect: 1`, then refreshes `/api/auth/session`. This can be reproduced with a small ignored Node helper and a local cookie jar.
- First-party Auth.js verification passes: credentials callback succeeds without a TOTP code; session claims show the expected email, `totpEnabled=false`, active MEMBER role, BUSINESS tier, and isolated organization.
- Protected-route smoke results expose database deployment drift rather than account failure: `/produkte`, `/versand`, `/einstellungen`, and `/team` return 200, while `/lager`, `/verkauf`, `/retouren`, `/konsignation`, and `/aufgaben` return 500. Server logs must identify the exact missing schema objects before the account can honestly be described as able to test every module.
- Server diagnostics identify only missing Prompt-1 schema objects: `feature_entitlements`, `inventory_positions.item_condition`, `stock_items.item_condition`, `sales.marketplace_account_id`, and `tasks.scope`.
- The pending additive migration `20260713100000_beta_domain_entitlements` creates exactly those columns/tables plus related domain foundation, FKs, checks, indexes, and forced RLS policies. Applying it is a meaningful external schema change and is not implicitly authorized by merely creating a user account.
- Authorized deployment reached the known historical BOM defect in `20260709100000_product_brand` and stopped before the beta migration. Prisma recorded a failed attempt, so migration history must be reconciled before deploy can continue.
- Read-only inspection proves `products.brand` already exists, the failed BOM migration applied zero steps, and none of the sampled beta columns/tables exists. It is therefore correct to resolve only `20260709100000_product_brand` as applied, then deploy the untouched beta migration normally.
- Prisma history resolution succeeded for the already-present product-brand change. The untouched `20260713100000_beta_domain_entitlements` migration then deployed successfully; Prisma reports all 18 migrations applied.
- Final migration status is clean. Re-running the idempotent QA provisioner upgraded entitlement mode from BUSINESS fallback to a real active MANUAL `CONSIGNMENT` grant while preserving MEMBER role and disabled TOTP.
- Post-migration Auth.js verification passes without a TOTP code. All nine representative protected routes return HTTP 200: products, inventory, sales, returns, shipping, consignment, tasks, settings, and team.
- Dev-server output for the verification run contains successful compile/request lines and no Prisma, entitlement, auth, or route errors.
- Post-deploy `integrity:check` passes all 13 inventory, allocation, tenant-link, document-number, and movement-replay invariants with zero violations.
- Temporary provisioning/verification/inspection helpers were removed. Only the ignored local `.env.qa.local` credential file remains for future autonomous login.
# Prompt 5 browser and deployment findings (2026-07-14)

- Docker Desktop is installed but its service/engine is unavailable on this laptop. The safe workaround was the user's explicitly approved isolated external QA database, not an unreviewed local database substitution.
- The QA account intentionally remains a password-only `MEMBER`: the existing application policy requires 2FA for `ADMIN` and `OWNER`. Browser data setup used an isolated tenant-scoped maintenance transaction and did not introduce an authentication bypass.
- The active QA catalogs contain 17 reviewed eBay leaf categories with 265 generated rules and 13 published Kaufland groups. Ambiguous or structurally unsupported fee cases remain excluded/review-required rather than being presented as official active facts.
- Responsive QA showed no document-level horizontal overflow. Dense product and expense tables keep their own bounded horizontal scrollers at tablet/mobile widths.
- Coordinate activation of some Radix controls was unreliable in the local browser driver, while semantic DOM activation and keyboard behavior worked correctly. This was treated as an automation-driver limitation after dialogs, selection state, Escape close, and focus restoration were verified in the live application.

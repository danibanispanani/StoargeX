# Findings and Decisions

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

---

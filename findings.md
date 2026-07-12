# Findings and Decisions

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

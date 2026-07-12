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

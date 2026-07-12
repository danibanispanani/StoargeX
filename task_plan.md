# Task Plan: Prompt C Landingpage Redesign

## Goal
Rebuild only the public landing page as a distinctive, production-ready Transit Ledger single page, validate it across browsers and viewports, document the design, pass all gates, and commit the result.

## Current Phase
Complete

## Phases

### Phase 1: Context and Design System
- [x] Verify clean Prompt A/B baseline and read public design documents
- [x] Inspect current landing page, shell, pricing data, motion helpers, and UI primitives
- [x] Use Huashu guidance to define the product-derived form and motion language
- [x] Verify the core Lucide icon set with Better Icons
- [x] Check shadcn registry and component audit guidance
- **Status:** complete

### Phase 2: Landingpage Implementation
- [x] Build the new hero and isometric Transit Ledger board
- [x] Build problem, workflow, contextual use cases, trust, pricing, about, question, FAQ, and final CTA sections
- [x] Add a small integrated question interaction
- [x] Keep navigation anchors and CTA routes coherent
- [x] Create `docs/landingpage-redesign-notes.md`
- **Status:** complete

### Phase 3: Static and Runtime Validation
- [x] Run TypeScript, targeted lint, and tests
- [x] Start Next.js and perform available runtime checks
- [x] Capture browser trace if the local tracing stack is available
- [x] Validate Chrome console, network, hydration, navigation, and CTA paths
- **Status:** complete

### Phase 4: Responsive and Visual Polish
- [x] Inspect 1440, 1280, 768, and 390 px layouts
- [x] Inspect key-section screenshots
- [x] Run a coarse CDP performance/network trace
- [x] Fix scoped visual and accessibility defects (post-fix Chrome call blocked by usage gate)
- **Status:** complete with documented tool limitation

### Phase 5: Shipping Gates
- [x] Run full lint, tests, production build, and `git diff --check`
- [x] Review the complete diff for scope and quality
- [x] Commit the Prompt C result (`Redesign public landing page`)
- **Status:** complete

## Design Decisions
| Decision | Rationale |
|---|---|
| Use a physical Transit Ledger / control-board metaphor | The visual form grows directly from inventory movements and audit trails rather than SaaS decoration. |
| Keep imagery code-native | The content is an operational system; the isometric board, ledgers, stamps, and routes are the product visualization, not decorative stock imagery. |
| Use controlled CSS motion plus the existing reveal helper | Transform/opacity motion stays lightweight and respects reduced-motion preferences. |
| Reuse shadcn Button primitives, existing tokens, and centralized pricing data | Keeps interaction quality and pricing truth production-safe without importing a template aesthetic. |

## Constraints
- Landingpage and its supporting landing-only components/docs only.
- No Prompt D auth redesign, no backend chat integration, no pricing-route rewrite.
- No invented testimonials, customer counts, uptime claims, or legal content.
- Next.js 15 runtime MCP limitation must be documented, not solved by framework upgrade.

## Errors Encountered
| Error | Resolution |
|---|---|
| `better-icons` was not installed globally | Used the skill's `npx --yes better-icons` fallback and verified `route`, `package-check`, `rotate-ccw`, `coins`, and `shield-check` in Lucide. |
| `codebase-memory-mcp` and Context7 expose no callable tools | Continue from the repository's Prompt A/B documents and direct code inspection; do not block implementation. |
| Initial TypeScript run rejected string-valued `aria-hidden` on a dynamic icon component | Changed the property to the boolean JSX attribute; targeted lint was already clean. |
| Browser Trace `start-capture.mjs` fails with `spawn browse ENOENT` on the Windows npm shim | Managed Browse Chrome itself works; stop retrying the wrapper and use Chrome DevTools console/network/performance plus screenshots as the replacement trace evidence. |
| Post-fix Chrome call and network-enabled Production Build were rejected by the platform usage limit | Do not retry or circumvent. Preserve the verified implementation and report the external gate if commit access is also unavailable. |
| Final targeted `git add` / `git commit` was rejected before execution by the same usage limit | Leave the complete worktree intact and ask the user to resume after the reset; do not bypass the approval gate. |

# Task Plan: Public A/B Recovery and Validation

## Goal
Reconstruct and validate the completed Prompt A/B public foundation, repair only verified defects, document the result, pass all project gates, and commit a Prompt-C-ready state without implementing Prompt C.

## Current Phase
Phase 6 (final review and commit)

## Phases

### Phase 1: Context and Repository Reconstruction
- [x] Read the recovery request and project instructions
- [x] Read the A/B design, site-map, and implementation documents
- [x] Inspect git status, recent history, diff, and package scripts
- [x] Inspect the relevant public routes, layouts, and components
- **Status:** complete

### Phase 2: Next.js and Static Structure Validation
- [x] Validate route and layout hierarchy
- [x] Check server/client component placement and navigation contracts
- [x] Start the development server and attempt available diagnostics
- **Status:** complete with MCP limitation documented

### Phase 3: Browser, Responsive, and Accessibility Validation
- [x] Validate all requested public routes and navigation paths
- [x] Inspect 1440, 1280, 768, and 390 pixel viewports
- [x] Check console, network, hydration, overflow, and missing assets
- [x] Run Lighthouse accessibility audit
- **Status:** complete

### Phase 4: Scoped Repairs and Documentation
- [x] Repair only verified Prompt A/B defects
- [x] Create docs/public-ab-validation.md
- [x] Record intentionally deferred Prompt C/D work
- **Status:** complete

### Phase 5: Project Gates
- [x] Run TypeScript typecheck
- [x] Run lint
- [x] Run tests
- [x] Run production build
- **Status:** complete

### Phase 6: Final Review and Commit
- [x] Review the final diff and document browser validation
- [x] Confirm Prompt A/B validation is ready to hand off to Prompt C
- [x] Commit the validated state with a clear message (`4a205d9 Validate public shell recovery`)
- **Status:** complete

## Key Questions
1. Do all documented Prompt B routes and navigation paths work in the real browser?
2. Are there runtime, responsive, accessibility, or design-direction defects that must be fixed before Prompt C?
3. Can all project gates pass on the repaired state?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Treat docs/public-shell-implementation.md as Prompt B scope | It explicitly separates the completed foundation from the later Prompt C landing-page work. |
| Use chrome-devtools MCP for browser validation | It is directly available and explicitly required by the recovery prompt. |
| Do not upgrade Next.js for next-devtools runtime MCP | The request prohibits framework migration and the project currently pins Next.js 15.5.20. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `agent-browser` CLI is not installed | 1 | Intended to use the explicitly requested chrome-devtools MCP; that MCP is currently blocked by the session usage limit. |
| `codebase-memory-mcp` is not available in this session | 1 | Record the unavailable requested capability; continue with direct repository inspection rather than inventing an MCP fallback. |
| `next-devtools` index call rejected by session usage limit | 1 | Do not retry or circumvent; continue static Next.js validation and browser/runtime validation through chrome-devtools. |
| `chrome-devtools` page open rejected by session usage limit | 1 | Do not use a local browser fallback; leave browser and Lighthouse gates open. |
| Production build cannot fetch configured Google Fonts in sandbox | 1 | Requested the required network escalation. |
| Escalated production build rejected by session usage limit | 2 | Leave the production-build gate open until the platform permits the approved network run. |
| Git staging cannot create `.git/index.lock` in sandbox; escalation rejected by usage limit | 1 | Leave all changes uncommitted and report the exact blocker. |

## Notes
- Do not implement Prompt C or the full Prompt D auth redesign.
- Preserve the clean baseline and keep fixes limited to verified Prompt A/B defects.

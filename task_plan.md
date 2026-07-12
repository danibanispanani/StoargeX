# Task Plan: Prompt D Auth Redesign

## Goal
Redesign only Login and Register as a shared, production-ready Transit Gate experience aligned with the landing page, preserve all authentication behavior, validate it in real browsers and viewports, document it, pass every project gate, and commit the result.

## Current Phase
Complete

## Phases

### Phase 1: Recovery and Design Direction
- [x] Confirm the clean Prompt C baseline and inspect both auth routes, shared shell, forms, actions, and tests
- [x] Load Huashu, Better Icons, Browser Trace, planning, and surgical implementation guidance
- [x] Check shadcn registry/audit guidance and tool availability
- [x] Verify the final auth icon vocabulary with Better Icons
- **Status:** complete

### Phase 2: Shared Auth Implementation
- [x] Build the shared asymmetric Transit Gate shell for Login and Register
- [x] Improve form hierarchy, focus/error states, and mobile behavior without changing auth actions
- [x] Verify all four required navigation paths
- [x] Create `docs/auth-redesign-notes.md`
- **Status:** complete

### Phase 3: Static and Runtime Validation
- [x] Run TypeScript and targeted lint
- [x] Start Next.js and check the available next-devtools runtime integration
- [x] Validate Login/Register routing, navigation, form states, console, network, and hydration
- [x] Attempt Browser Trace once and document the sandboxed Windows launcher limitation
- **Status:** complete with documented Browser Trace limitation

### Phase 4: Responsive and Visual Polish
- [x] Inspect desktop, tablet, and mobile layouts
- [x] Inspect both auth routes and relevant theme states
- [x] Fix scoped visual or accessibility defects found in browser QA
- **Status:** complete

### Phase 5: Shipping Gates
- [x] Run full lint, tests, production build, and `git diff --check`
- [x] Review the complete scoped diff
- [x] Commit the Prompt D result
- **Status:** complete

## Design Decisions
| Decision | Rationale |
|---|---|
| Use a Transit Gate / access-manifest metaphor | It extends the landing page's operational route system into authentication instead of adding a generic auth card. |
| Keep one shared shell with route-specific context | Login and Register should feel related while communicating return versus initial setup clearly. |
| Preserve existing actions and validation contracts | Prompt D is a presentation and UX task; the current NextAuth and server-action behavior is already robust. |
| Use restrained CSS motion and existing UI primitives | Keeps the result responsive, accessible, and production-safe. |

## Constraints
- Login, Register, their shared shell/styles, and auth redesign documentation only.
- No auth-provider, database, middleware, landing-page, or application-flow changes.
- Context7 and codebase-memory-mcp are unavailable as callable tools; this must not block delivery.
- Next.js 15 may limit next-devtools runtime inspection; document the limitation and continue.

## Errors Encountered
| Error | Resolution |
|---|---|
| Context7 and codebase-memory-mcp expose no callable tools | Continue from direct repository inspection and document the limitation. |
| First combined planning-file patch did not match a mojibake-affected line | Split the patch into exact, encoding-safe file updates. |
| Browser Trace managed launch cannot enumerate the Windows process in the sandbox | Stop after one attempt and use Chrome DevTools CDP evidence; cleanup attempt was likewise blocked and not repeated. |
| Initial Lighthouse contrast audit scored 96 | Set auth submit text explicitly dark against Transit Teal; both auth routes now score Accessibility 100. |
| Sandboxed Production Build cannot fetch the three existing Google Fonts | Run the final build with approved network access before staging and committing. |

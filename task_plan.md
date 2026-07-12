# Task Plan: Prompt E Public Experience Polish

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

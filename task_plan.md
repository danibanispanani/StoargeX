# Task Plan: Public Shell Foundation

## Goal
Implement Prompt B foundation for StorageX public surface: design tokens, public shell, navigation, footer, legal/about routes, auth routing, documentation, validation, and commit.

## Phases
1. Inspect Prompt A docs and current public routes. Status: complete.
2. Build public design tokens and shell modules. Status: complete.
3. Add header, footer, legal/about routes. Status: complete.
4. Wrap login/register in public auth shell. Status: complete.
5. Document implementation and run validation. Status: complete.
6. Commit completed phase. Status: complete.

## Constraints
- No full landingpage rebuild in this phase.
- No final auth redesign flow; only shared shell/routing foundation.
- No invented final legal text; placeholders must be clearly marked.
- Existing auth forms and pricing logic stay functional.

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| MCP tools unavailable in current session | tool_search for requested MCP names | Proceed with local repo analysis; document limitation. |
| PowerShell AGENTS check used invalid positional args | Get-ChildItem with multiple unbound paths | Re-ran with `rg --files -g AGENTS.md app components docs`. |
| Normal sandbox build blocked Google Fonts fetch | `npm run build` without network | Re-ran `npm run build` with approved network access. |

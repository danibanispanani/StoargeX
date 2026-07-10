# StorageX Agent Instructions

## Project Context
- StorageX is a Next.js/React app with Prisma-backed inventory, sales, returns, consignment, debts, imports, and reporting.
- Treat inventory as a movement-based system. Do not directly overwrite stock counters such as `quantityAvailable` unless the existing local code explicitly does so for legacy records.
- For current inventory positions, stock changes must flow through `InventoryMovement` services such as `SALE_OUT`, `RETURN_*`, `ADJUSTMENT_IN`, and `ADJUSTMENT_OUT`.

## Working Rules
- Check `git status --short` before editing. The worktree may contain user changes; never revert unrelated changes.
- Keep changes scoped to the requested workflow. Avoid broad refactors unless they are required to fix the root cause.
- Prefer existing service/action patterns under `lib/actions/*` and `lib/services/*`.
- Use `apply_patch` for manual edits.
- Do not commit, branch, or reset unless the user explicitly asks.

## Validation
- For TypeScript or UI changes, run `npx tsc --noEmit` when practical.
- For focused domain changes, run the closest Vitest files first, for example `tests/*service*.test.ts`.
- If full `npm run lint` fails on unrelated existing files, report that and run targeted lint on changed files.

## Domain Notes
- Consignment sales happen through `/verkauf`; returns and defects happen through `/retouren`.
- Consignment UI should not expose direct sale, return, or defect buttons.
- Channel price fields from imports such as `vk_preis`, `vk_ki`, and `preis_mm` are historical noise unless a task explicitly reintroduces them.
- Historical CSV details may be displayed read-only, but should not be mixed into editable master-data comments.

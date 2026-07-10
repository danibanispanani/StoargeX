# Findings: Public Shell Foundation

- Current public routes: `/`, `/pricing`, `/login`, `/registrieren`, `/einladung/[token]`.
- Missing required public routes: `/impressum`, `/datenschutz`, `/agb`, `/about`.
- Existing shell is `components/marketing/marketing-shell.tsx` with minimal nav/footer only.
- Existing design tokens already define `ink`, `fog`, `slate`, `cargo-amber`, `transit-teal`, `customs-red`.
- Prompt A direction extends tokens with Paper, Rail, Stamp, Mint Signal and uses the "Transit Ledger" language.
- Auth pages currently have no backlink to landingpage and no legal/footer structure.
- Current session exposes no requested MCP tools via tool index; browser validation will need local commands or later session restart.
- `MarketingNav`/`MarketingFooter` can be deepened into a reusable Public shell without changing existing landing/pricing imports.
- Legal routes should use placeholder structures only; no final legal claims should be invented.

# Navigation and Feature Entitlement Map

## Navigation principles

Navigation follows operational flow, not database tables: observe -> acquire -> hold -> sell -> resolve -> settle -> configure. Entitlement gates are evaluated after session, organization, and role checks. A denied add-on never deletes data or changes historical document access.

| Navigation area / route | Primary job | Minimum role | Entitlement | Data behavior when entitlement is absent |
|---|---|---:|---|---|
| `/dashboard` | Attention, trend, score explanation, next action | READONLY | Core | Show core data; consignment-derived historical totals remain explainable but no consignment operation is offered. |
| `/lager` | Owned inventory positions and purchase intake | READONLY / MEMBER to change | Core | Core. |
| `/produkte` | Reusable product catalogue | READONLY / MEMBER to change | Core | Core. |
| `/einkauf` (planned) | Purchases, supplier reference, owned-lot intake | READONLY / MEMBER to change | Core | Core. |
| `/verkauf` | Sale documents and allocation-aware posting/cancellation | READONLY / MEMBER to change | Core | Consignment inventory may be allocated only when the consignment entitlement permits the action. |
| `/retouren/kunden` | Customer-return intake, inspection, restock/defect decision | READONLY / MEMBER to change | Core | Core. |
| `/retouren/lieferanten` | Supplier-return planning, dispatch, credit/refund and stock consequence | READONLY / MEMBER to change | Core | Core; dispatch is server-side movement-gated. |
| `/konsignation` | Consignment positions, partner settlement, operational review | READONLY / MEMBER to change | `consignment` add-on | Navigation and mutation unavailable; data retained, linked documents/history readable. |
| `/schulden` | Receivables/payables and source-linked settlement | READONLY / MEMBER to change | Core | Core. |
| `/aufgaben` | Team work queue | READONLY / MEMBER to change | Core | Core. |
| `/versand` | Carrier rates and shipping calculation | READONLY / MEMBER/ADMIN to change | Current PRO shipping capability | No rate editing or premium calculation entry point. |
| `/importe` (planned) | Templates, dry runs, errors, commit history | READONLY / MEMBER to commit | Core | Read-only history by role; no import action if role lacks write access. |
| `/zugangsdaten` | Encrypted operational credentials | ADMIN | Current BUSINESS vault capability | No secret metadata or reveal access. |
| `/team` | Membership and invitations | READONLY / ADMIN to manage | Core | Core. |
| `/einstellungen/stammdaten` (planned section) | Platforms/accounts, suppliers, parties, payment accounts, payout recipients, tax/carriers | READONLY / ADMIN to manage | Core | Historical snapshots remain readable; configuration changes role-protected. |
| `/einstellungen` and `/einstellungen/sicherheit` | Organization, billing, privacy, personal security | READONLY / ADMIN/OWNER by action | Core | Billing/organization deletion remain OWNER-only. |

## Entitlement contract

- Add-on entitlement is a capability check independent of role. A MEMBER with an entitlement may perform allowed operational actions; an OWNER without the entitlement may not bypass it.
- Role checks, RLS, and server-side authorization always run before an entitlement result is used for UI or mutation decisions.
- Route hiding is not authorization. Server actions and read projections enforce the same entitlement contract.
- Existing subscription tiers are not changed by this document. The dedicated `consignment` entitlement is the target product rule; mapping it to a future billing offer requires a separately approved tariff decision.
- Exports and historical document details retain required consignment references for authorized users even when the add-on is inactive. They must identify the feature as unavailable for new operations rather than presenting data loss.

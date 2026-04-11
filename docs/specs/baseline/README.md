# Baseline feature specs

Concise **current-state** specifications for the Carwoods SPA, aligned with [`../SPEC_TEMPLATE.md`](../SPEC_TEMPLATE.md). Use these as regression anchors when changing behavior.

Each spec (except this index) includes **Metadata** after its title: **Priority** (P0–P2) and **Owner**. Defaults are by criticality and product area: **P0** covers routing shells, core i18n/theme, primary marketing nav, and portal entry/layout/auth/routing/requests; **P1** covers remaining portal and apply specs plus other marketing and shared-platform specs; **P2** covers legal pages, analytics, footer, and printable marketing. **Owner** is **Marketing Team** (marketing, legal, apply), **Platform Team** (shared platform: routing, theme, i18n, tokens, analytics), or **Portal Team** (portal features).

| Spec | Priority | Owner |
|------|----------|--------|
| [analytics-vercel.md](./analytics-vercel.md) | P2 | Platform Team |
| [app-routing-shells.md](./app-routing-shells.md) | P0 | Platform Team |
| [apply-applicant-wizard.md](./apply-applicant-wizard.md) | P1 | Marketing Team |
| [apply-flow-subnav.md](./apply-flow-subnav.md) | P1 | Marketing Team |
| [apply-overview.md](./apply-overview.md) | P1 | Marketing Team |
| [apply-rental-property-tiles.md](./apply-rental-property-tiles.md) | P1 | Marketing Team |
| [apply-required-documents.md](./apply-required-documents.md) | P1 | Marketing Team |
| [apply-tenant-selection-criteria.md](./apply-tenant-selection-criteria.md) | P1 | Marketing Team |
| [feature-dark-theme.md](./feature-dark-theme.md) | P1 | Platform Team |
| [global-styles-design-tokens.md](./global-styles-design-tokens.md) | P1 | Platform Team |
| [i18n-languages-rtl.md](./i18n-languages-rtl.md) | P0 | Platform Team |
| [legal-accessibility.md](./legal-accessibility.md) | P2 | Marketing Team |
| [legal-privacy.md](./legal-privacy.md) | P2 | Marketing Team |
| [legal-terms-of-service.md](./legal-terms-of-service.md) | P2 | Marketing Team |
| [marketing-contact-us.md](./marketing-contact-us.md) | P1 | Marketing Team |
| [marketing-footer.md](./marketing-footer.md) | P2 | Marketing Team |
| [marketing-home.md](./marketing-home.md) | P1 | Marketing Team |
| [marketing-printable-pages.md](./marketing-printable-pages.md) | P2 | Marketing Team |
| [marketing-property-management.md](./marketing-property-management.md) | P1 | Marketing Team |
| [marketing-responsive-navbar.md](./marketing-responsive-navbar.md) | P0 | Marketing Team |
| [portal-admin-ai-settings.md](./portal-admin-ai-settings.md) | P1 | Portal Team |
| [portal-admin-landlords.md](./portal-admin-landlords.md) | P1 | Portal Team |
| [portal-auth-gate.md](./portal-auth-gate.md) | P0 | Portal Team |
| [portal-dashboard.md](./portal-dashboard.md) | P1 | Portal Team |
| [portal-layout-chrome.md](./portal-layout-chrome.md) | P0 | Portal Team |
| [portal-login-landing.md](./portal-login-landing.md) | P1 | Portal Team |
| [portal-profile.md](./portal-profile.md) | P1 | Portal Team |
| [portal-properties.md](./portal-properties.md) | P1 | Portal Team |
| [portal-requests.md](./portal-requests.md) | P0 | Portal Team |
| [portal-route-guard.md](./portal-route-guard.md) | P0 | Portal Team |
| [portal-shared-ui-patterns.md](./portal-shared-ui-patterns.md) | P1 | Portal Team |
| [portal-status-diagnostics.md](./portal-status-diagnostics.md) | P1 | Portal Team |
| [portal-tenants-leases.md](./portal-tenants-leases.md) | P1 | Portal Team |
| [routing-dark-preview.md](./routing-dark-preview.md) | P1 | Platform Team |
| [theme-mode-appearance.md](./theme-mode-appearance.md) | P0 | Platform Team |

## Metadata override guide

- **Raise to P0 when:** the feature can block sign-in/navigation, affect cross-cutting behavior (routing, theme, language, auth), create high-support incidents, or impact legal/compliance obligations.
- **Lower to P1/P2 when:** changes are mostly static copy/content, have limited blast radius, or have safe rollback with minimal user impact.
- **Owner transfer triggers:** move owner when primary implementation responsibility shifts for 2+ consecutive releases, when architectural ownership changes, or when dependency ownership is formally reassigned.
- **Owner update rule:** update spec metadata and this index in the same PR that changes feature ownership; avoid partial ownership drift.
- **Review cadence:** P0 monthly, P1 quarterly, P2 every two quarters (or on-demand when touched by a PR).
- **Review checklist:** confirm scope is still accurate, acceptance criteria reflect current behavior, validation commands still run, and traceability paths are up to date.

## Marketing

| Spec | Title |
|------|--------|
| [marketing-home.md](./marketing-home.md) | Marketing Home |
| [marketing-contact-us.md](./marketing-contact-us.md) | Marketing Contact Us |
| [marketing-property-management.md](./marketing-property-management.md) | Marketing Property Management |
| [legal-privacy.md](./legal-privacy.md) | Privacy Policy |
| [legal-terms-of-service.md](./legal-terms-of-service.md) | Terms of Service |
| [legal-accessibility.md](./legal-accessibility.md) | Accessibility Statement |
| [marketing-footer.md](./marketing-footer.md) | Marketing Footer |
| [marketing-responsive-navbar.md](./marketing-responsive-navbar.md) | Responsive Navbar |
| [marketing-printable-pages.md](./marketing-printable-pages.md) | Marketing Printable Pages |

## Apply

| Spec | Title |
|------|--------|
| [apply-overview.md](./apply-overview.md) | Apply Overview |
| [apply-tenant-selection-criteria.md](./apply-tenant-selection-criteria.md) | Tenant Selection Criteria |
| [apply-required-documents.md](./apply-required-documents.md) | Application Required Documents |
| [apply-flow-subnav.md](./apply-flow-subnav.md) | Apply Flow Sub-navigation |
| [apply-applicant-wizard.md](./apply-applicant-wizard.md) | Applicant Wizard |
| [apply-rental-property-tiles.md](./apply-rental-property-tiles.md) | Rental Property Apply Tiles |

## Shared platform

| Spec | Title |
|------|--------|
| [app-routing-shells.md](./app-routing-shells.md) | App Routing and Shells |
| [routing-dark-preview.md](./routing-dark-preview.md) | Dark Preview Routing |
| [theme-mode-appearance.md](./theme-mode-appearance.md) | Theme Mode and Appearance |
| [feature-dark-theme.md](./feature-dark-theme.md) | Dark Theme Feature Flag |
| [i18n-languages-rtl.md](./i18n-languages-rtl.md) | Internationalization and RTL |
| [global-styles-design-tokens.md](./global-styles-design-tokens.md) | Global Styles and Design Tokens |
| [analytics-vercel.md](./analytics-vercel.md) | Vercel Analytics |

## Portal

| Spec | Title |
|------|--------|
| [portal-auth-gate.md](./portal-auth-gate.md) | Portal Auth Gate |
| [portal-login-landing.md](./portal-login-landing.md) | Portal Login Landing |
| [portal-layout-chrome.md](./portal-layout-chrome.md) | Portal Layout Chrome |
| [portal-route-guard.md](./portal-route-guard.md) | Portal Route Guard |
| [portal-dashboard.md](./portal-dashboard.md) | Portal Dashboard |
| [portal-requests.md](./portal-requests.md) | Portal Requests |
| [portal-profile.md](./portal-profile.md) | Portal Profile |
| [portal-status-diagnostics.md](./portal-status-diagnostics.md) | Portal Status Diagnostics |
| [portal-admin-landlords.md](./portal-admin-landlords.md) | Portal Admin Landlords |
| [portal-admin-ai-settings.md](./portal-admin-ai-settings.md) | Portal Admin AI Settings |
| [portal-properties.md](./portal-properties.md) | Portal Properties |
| [portal-tenants-leases.md](./portal-tenants-leases.md) | Portal Tenants and Leases |
| [portal-shared-ui-patterns.md](./portal-shared-ui-patterns.md) | Portal Shared UI Patterns |

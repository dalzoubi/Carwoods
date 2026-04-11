# Portal Admin AI Settings (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document admin AI configuration area under `/portal/admin/config` (redirect from `/portal/admin/ai`).
- **Why now:** Splits UI across settings/agents/config subcomponents as present in repo.
- **Related docs/issues/links:** `PortalAdminAiSettings.jsx`, `PortalAdminAiConfig.jsx`, `PortalAdminAiAgents.jsx`.

## 2) Scope

- **In scope:** Admin-only routes in `App.jsx`, MUI forms for AI-related settings exposed by the API, tests for settings surface.
- **Out of scope:** Model provider keys in client bundle (must remain server-side); undisclosed LLM prompts.

## 3) Users and stories

- As an **admin**, I want to adjust AI-related settings, so that portal assistants behave per business rules.
- As an **admin**, I want validation errors on bad input, so that misconfiguration is caught early.

## 4) Constraints and assumptions

- **Technical:** `PortalRouteGuard` with `Role.ADMIN`; uses `portalApiClient` for reads/writes as wired.
- **Assumptions:** Baseline documents presence of module and tests—not every AI endpoint.

## 5) Acceptance criteria

1. Given I hit `/portal/admin/ai`, when routes resolve, then I am redirected to `/portal/admin/config` per `App.jsx`.
2. Given admin access, when settings page loads, then forms/tabs render using theme tokens (no raw hex).
3. Given save flows, when API errors, then user sees feedback consistent with other admin pages.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalAdminAiSettings.test.jsx`, `npx eslint src/components/PortalAdminAi*.jsx`
- **Manual:** Exercise settings save with API; verify non-admin redirect.

## 7) Implementation plan

- Baseline only. New AI capabilities: extend components + API client + backend together.

## 8) Risks and mitigations

- **Risk:** Misconfigured AI keys in env typos. **Mitigation:** Status page + API health checks.

## 9) Rollback plan

- Revert admin AI UI; API defaults handle missing config if designed to.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalAdminAiSettings.jsx`, `src/components/PortalAdminAiConfig.jsx`, `src/components/PortalAdminAiAgents.jsx`, `src/App.jsx`, `src/lib/portalApiClient.js`
- **Tests:** `src/components/PortalAdminAiSettings.test.jsx`
- **Acceptance criteria status:** Baseline.

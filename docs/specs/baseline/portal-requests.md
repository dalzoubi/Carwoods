# Portal Requests (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document the maintenance/service requests split-pane experience: list, detail, and create/update flows on the client.
- **Why now:** Core tenant/landlord workflow; uses dedicated hooks and API helpers.
- **Related docs/issues/links:** `usePortalRequests.js`, `portalRequests/api.js`, `RequestListPane.jsx`, `RequestDetailPane.jsx`, `TenantRequestForm.jsx`.

## 2) Scope

- **In scope:** `/portal/requests` UI, responsive list/detail layout, status chips, forms as implemented, client calls via `portalApiClient` patterns used in `api.js`.
- **Out of scope:** Exact SLA or notification channels for staff (not defined in frontend baseline).

## 3) Users and stories

- As a **tenant**, I want to open and track requests, so that maintenance issues are recorded.
- As a **landlord**, I want to see tenant requests for my properties, so that I can respond.

## 4) Constraints and assumptions

- **Technical:** Route guarded for tenant, landlord, admin (`App.jsx`); errors surface per hook/API error object shape `{ status, code, message }`.
- **Assumptions:** Bearer token from portal auth is required for API calls.

## 5) Acceptance criteria

1. Given authenticated allowed role, when I open `/portal/requests`, then list pane loads and selecting an item shows detail pane on desktop.
2. Given mobile viewport, when I use the flow, then stacked navigation between list and detail works as implemented.
3. Given API error, when operation fails, then user sees non-silent feedback (alert/snackbar per implementation).

## 6) Validation plan

- **Automated:** `npx vitest run src/components/portalRequests/*.test.jsx src/components/portalRequests/usePortalRequests.test.jsx`
- **Manual:** Create/edit request happy path against a configured API environment.

## 7) Implementation plan

- Baseline only. Feature work: extend hooks, panes, and `portalRequests/api.js` together with backend contract.

## 8) Risks and mitigations

- **Risk:** Stale list after mutation. **Mitigation:** Hook refetch logic (verify in `usePortalRequests`).

## 9) Rollback plan

- Revert requests module commits; API remains backward compatible if possible.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalRequests.jsx`, `src/components/portalRequests/*`, `src/lib/portalApiClient.js`
- **Tests:** `RequestListPane.test.jsx`, `RequestDetailPane.test.jsx`, `usePortalRequests.test.jsx`
- **Acceptance criteria status:** Baseline.

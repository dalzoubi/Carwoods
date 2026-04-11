# Portal Admin Landlords (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document `/portal/admin/landlords` admin tooling for landlord records as implemented in the SPA.
- **Why now:** Admin-only surface; uses portal forms and API client.
- **Related docs/issues/links:** `PortalAdminLandlords.jsx`, `portalApiClient`.

## 2) Scope

- **In scope:** UI for listing/searching/creating/updating landlord entities per current component (tables, dialogs, Snackbar feedback).
- **Out of scope:** Billing integration; email invites unless present in code.

## 3) Users and stories

- As an **admin**, I want to manage landlords, so that portal access and records stay accurate.
- As an **admin**, I want clear error messages on failed saves, so that I can correct input or retry.

## 4) Constraints and assumptions

- **Technical:** Wrapped with `PortalRouteGuard allowedRoles={[Role.ADMIN]}` in `App.jsx`.
- **Assumptions:** Mutations call `portalApiClient` functions—exact endpoints live in client module, not duplicated here.

## 5) Acceptance criteria

1. Given non-admin user with resolved `meStatus`, when visiting the URL, then guard redirects to `/portal`.
2. Given admin user, when page loads, then landlord list or empty state renders without blank screen.
3. Given save operation, when API returns error object, when UI handles it, then user-visible error appears.

## 6) Validation plan

- **Automated:** `npx eslint src/components/PortalAdminLandlords.jsx`; component tests if present
- **Manual:** CRUD smoke against staging API with admin account.

## 7) Implementation plan

- Baseline only. Coordinate with API schema in `apps/api` when changing fields.

## 8) Risks and mitigations

- **Risk:** Destructive actions without confirm. **Mitigation:** Keep confirm dialogs for deletes if added.

## 9) Rollback plan

- Revert admin UI commits; data changes depend on API transactions.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalAdminLandlords.jsx`, `src/App.jsx`, `src/lib/portalApiClient.js`
- **Tests:** Add co-located tests when stabilizing behaviors
- **Acceptance criteria status:** Baseline.

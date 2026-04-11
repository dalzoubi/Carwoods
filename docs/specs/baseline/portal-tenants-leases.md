# Portal Tenants and Leases (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document `/portal/tenants` experience for landlord/admin (`PortalTenants`).
- **Why now:** Companion to properties for occupancy and lease-related UI.
- **Related docs/issues/links:** `PortalTenants.test.jsx`.

## 2) Scope

- **In scope:** Role-gated landlord+admin route, tables/cards for tenant/lease info as rendered by component, i18n, error handling.
- **Out of scope:** E-signature lease execution unless implemented in this component.

## 3) Users and stories

- As a **landlord**, I want to see tenants associated with my properties, so that I can manage relationships.
- As an **admin**, I want the same surface for support, so that I can diagnose issues.

## 4) Constraints and assumptions

- **Technical:** Guard matches `App.jsx` (`LANDLORD`, `ADMIN`); follow portal shared UI patterns.
- **Assumptions:** API-backed lists; exact columns defined in JSX.

## 5) Acceptance criteria

1. Given tenant-only portal user, when opening `/portal/tenants`, then redirect to `/portal` occurs after role resolves.
2. Given landlord/admin, when data loads, then table or list shows rows or a documented empty state.
3. Given API failure, when error propagates to UI, then user sees feedback instead of an infinite spinner.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalTenants.test.jsx`, `npx eslint src/components/PortalTenants.jsx`
- **Manual:** Verify columns match business expectations with real data.

## 7) Implementation plan

- Baseline only. Extend with new columns/filters alongside API changes.

## 8) Risks and mitigations

- **Risk:** PII on screen without masking. **Mitigation:** Product policy + minimal display fields.

## 9) Rollback plan

- Revert `PortalTenants.jsx` and related API helpers.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalTenants.jsx`, `src/App.jsx`, `src/lib/portalApiClient.js` (or related client as used)
- **Tests:** `src/components/PortalTenants.test.jsx`
- **Acceptance criteria status:** Baseline.

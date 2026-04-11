# Portal Properties (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document `/portal/properties` for landlord/admin property management UI (`PortalAdminProperties`).
- **Why now:** Distinct from marketing Property Management page; uses portal layout and APIs.
- **Related docs/issues/links:** `propertiesApiClient.js` if used by component.

## 2) Scope

- **In scope:** Role-gated access (`LANDLORD`, `ADMIN`), list/detail/edit patterns as implemented, loading and empty states.
- **Out of scope:** Public HAR listing sync (Apply tiles spec).

## 3) Users and stories

- As a **landlord**, I want to see properties assigned to me, so that I can manage them in the portal.
- As an **admin**, I want cross-landlord visibility, so that I can support operations.

## 4) Constraints and assumptions

- **Technical:** Route guard in `App.jsx` limits to landlord+admin; uses MUI `Paper variant="outlined"` patterns.
- **Assumptions:** Data retrieval via portal/API helpers in the component—baseline does not fix payload shapes.

## 5) Acceptance criteria

1. Given tenant role, when I navigate to `/portal/properties`, then guard redirects to `/portal`.
2. Given landlord/admin, when page loads, then property list or empty state appears with translated strings.
3. Given an error from the properties API, when handled, then user sees an Alert or similar non-silent message.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalAdminProperties.test.jsx`
- **Manual:** Landlord vs admin data scope against API.

## 7) Implementation plan

- Baseline only. Field additions need API + client updates.

## 8) Risks and mitigations

- **Risk:** Large lists without pagination hurt performance. **Mitigation:** Table virtualization if needed later.

## 9) Rollback plan

- Revert properties UI commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalAdminProperties.jsx`, `src/lib/propertiesApiClient.js`, `src/App.jsx`
- **Tests:** `src/components/PortalAdminProperties.test.jsx`
- **Acceptance criteria status:** Baseline.

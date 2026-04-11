# Portal Profile (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document the `/portal/profile` page for viewing/editing user profile fields exposed by the API.
- **Why now:** Uses shared portal patterns (Paper, Snackbar, inline errors).
- **Related docs/issues/links:** `useMeProfile.js`, `portalPersonValidation.js`.

## 2) Scope

- **In scope:** `PortalProfile.jsx`, form validation helpers, success/error feedback, i18n.
- **Out of scope:** Changing identity provider email in Firebase (unless explicitly wired).

## 3) Users and stories

- As a **signed-in user**, I want to update my profile, so that Carwoods has correct contact information.
- As a **user with invalid input**, I want validation errors before submit, so that I can fix fields.

## 4) Constraints and assumptions

- **Technical:** Guarded route for tenant, landlord, admin; uses MUI form controls with theme tokens.
- **Assumptions:** Profile load/save goes through `portalApiClient` or `useMeProfile` as coded—baseline does not enumerate fields.

## 5) Acceptance criteria

1. Given `meStatus` ok, when profile loads, then form fields populate from current `/me` or profile endpoint data.
2. Given I submit valid changes, when save succeeds, then success feedback appears (Snackbar per pattern).
3. Given validation fails, when I submit, then errors are shown and save is not sent.

## 6) Validation plan

- **Automated:** `npx vitest run src/hooks/useMeProfile.test.js`, profile-related tests if present
- **Manual:** Edit profile end-to-end against API; RTL.

## 7) Implementation plan

- Baseline only. Field changes require API alignment and validation updates.

## 8) Risks and mitigations

- **Risk:** Optimistic UI vs server rejection. **Mitigation:** Refresh profile after save error.

## 9) Rollback plan

- Revert profile component/hook changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalProfile.jsx`, `src/hooks/useMeProfile.js`, `src/portalPersonValidation.js`, `src/lib/portalApiClient.js`
- **Tests:** `src/hooks/useMeProfile.test.js`
- **Acceptance criteria status:** Baseline.

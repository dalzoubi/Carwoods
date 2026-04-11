# Portal Status Diagnostics (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document `/portal/status` troubleshooting UI: auth state, `/me` snapshot, configured env hints, and API health probe.
- **Why now:** Operators and developers use this to verify Firebase + API wiring.
- **Related docs/issues/links:** `portalApiClient.fetchHealth`, `PortalStatus.jsx`.

## 2) Scope

- **In scope:** Display of auth status, account email, me load/error, optional refresh, health check call, sign-out entry point.
- **Out of scope:** Full observability stack; secrets are not printed in full (baseline: masked or omitted per code).

## 3) Users and stories

- As a **support engineer**, I want to see health and auth diagnostics, so that I can triage login/API issues.
- As a **developer**, I want a refresh action, so that I can re-fetch health without reloading the SPA.

## 4) Constraints and assumptions

- **Technical:** Uses `fetchHealth` from `src/lib/portalApiClient.js`; requires `VITE_API_BASE_URL` for meaningful API checks.
- **Assumptions:** Page is role-gated like other shared portal tools (tenant/landlord/admin per `App.jsx`).

## 5) Acceptance criteria

1. Given I open `/portal/status` authenticated, when page loads, then chips/sections reflect `authStatus`, `meStatus`, and resolved role display as implemented.
2. Given I trigger health refresh, when API responds, then health chip shows ok/error state accordingly.
3. Given API base URL missing, when diagnostics render, then UI communicates misconfiguration without throwing.

## 6) Validation plan

- **Automated:** `npx eslint src/components/PortalStatus.jsx`; add tests if logic grows
- **Manual:** Toggle API down/up; compare env with displayed configuration hints.

## 7) Implementation plan

- Baseline only. Extend diagnostics by adding read-only fields carefully (no secret leakage).

## 8) Risks and mitigations

- **Risk:** Exposing sensitive tokens. **Mitigation:** Only show non-secret metadata; review diffs.

## 9) Rollback plan

- Revert `PortalStatus.jsx` changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalStatus.jsx`, `src/lib/portalApiClient.js`, `src/featureFlags.js`, `src/PortalAuthContext.jsx`
- **Tests:** None dedicated in baseline; add when adding logic
- **Acceptance criteria status:** Baseline.

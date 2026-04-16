# Apply Overview (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the `/apply` page: entry to the application flow, rental tiles, and sub-navigation.
- **Why now:** Apply is a primary conversion path and loads listings from the public API.
- **Related docs/issues/links:** `publicApplyProperties.js`, `featureFlags.js` (`VITE_API_BASE_URL` resolution).

## 2) Scope

- **In scope:** `Apply.jsx`, integration with `ApplyFlowSubnav`, `RentalPropertyApplyTiles`, wizard entry as implemented.
- **Out of scope:** HAR scraper reliability in CI; backend schema beyond what `publicApplyProperties.js` expects.

## 3) Users and stories

- As an **applicant**, I want to see available properties and start an application, so that I can proceed with renting.
- As a **developer**, I want predictable tile normalization, so that the UI stays stable when the API payload evolves slightly.

## 4) Constraints and assumptions

- **Technical:** `GET` to `{VITE_API_BASE_URL}/api/public/apply-properties`; normalize via `publicApplyProperties.js`.
- **Assumptions:** Without a working API URL or when the request fails, the tile region shows the localized empty or error state.

## 5) Acceptance criteria

1. Given `VITE_API_BASE_URL` is set and the endpoint returns tiles, when I open `/apply`, then listings render in the tile grid.
2. Given the request fails or returns an empty list, when I open `/apply`, then the user sees the empty or error messaging (no silent blank grid).
3. Given I use Apply subnav, when I switch steps, then the active section matches `ApplyFlowSubnav` behavior.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Apply.test.jsx src/publicApplyProperties.test.js`, `npx eslint src/`
- **Manual:** Light/dark, `/dark/apply`, RTL.

## 7) Implementation plan

- Baseline only. Edits: `Apply.jsx`, `publicApplyProperties.js`, env docs, tiles component.

## 8) Risks and mitigations

- **Risk:** API drift in tile shape. **Mitigation:** `normalizeApplyPropertyTile` enforces required keys.

## 9) Rollback plan

- Revert client fetch or normalization changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Apply.jsx`, `src/publicApplyProperties.js`
- **Tests:** `src/components/Apply.test.jsx`, `src/publicApplyProperties.test.js`
- **Acceptance criteria status:** Baseline.

# Apply Overview (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the `/apply` page: entry to the application flow, rental tiles, and sub-navigation.
- **Why now:** Apply is a primary conversion path and integrates optional API + generated data.
- **Related docs/issues/links:** `publicApplyProperties.js`, `featureFlags.js` (apply API flags in AGENTS.md).

## 2) Scope

- **In scope:** `Apply.jsx`, integration with `ApplyFlowSubnav`, `RentalPropertyApplyTiles`, wizard entry as implemented, dual-source logging when enabled.
- **Out of scope:** HAR scraper reliability in CI; backend schema beyond what `publicApplyProperties.js` expects.

## 3) Users and stories

- As an **applicant**, I want to see available properties and start an application, so that I can proceed with renting.
- As a **developer**, I want a deterministic fallback to `rentalPropertyApplyTiles.generated.js`, so that the page works when the API is off or fails.

## 4) Constraints and assumptions

- **Technical:** Optional `GET` to `{VITE_API_BASE_URL}/api/public/apply-properties` when env flags allow; normalize via `publicApplyProperties.js`.
- **Assumptions:** Generated file is committed and must not be deleted (per `AGENTS.md`).

## 5) Acceptance criteria

1. Given `VITE_API_BASE_URL` is unset or feature off, when I open `/apply`, then tiles load from the generated data path without user-visible error.
2. Given API is enabled and reachable, when I open `/apply`, then the app attempts API-first load then falls back as coded.
3. Given I use Apply subnav, when I switch steps, then the active section matches `ApplyFlowSubnav` behavior.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Apply.test.jsx src/publicApplyProperties.test.js`, `npx eslint src/`
- **Manual:** Light/dark, `/dark/apply`, RTL, console checks for dual-source logging when enabled.

## 7) Implementation plan

- Baseline only. Edits: `Apply.jsx`, `publicApplyProperties.js`, env docs, tiles component.

## 8) Risks and mitigations

- **Risk:** API/generator drift in tile shape. **Mitigation:** `normalizeApplyPropertyTile` enforces required keys.

## 9) Rollback plan

- Toggle env flags or revert client fetch changes; keep generated file.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Apply.jsx`, `src/publicApplyProperties.js`, `src/data/rentalPropertyApplyTiles.generated.js`, `scripts/fetchHarRentalApplyTiles.mjs`
- **Tests:** `src/components/Apply.test.jsx`, `src/publicApplyProperties.test.js`
- **Acceptance criteria status:** Baseline.

# Rental Property Apply Tiles (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the property tile grid on Apply: data sources, normalization, and presentation.
- **Why now:** Tiles show portal-managed listings from the public API.
- **Related docs/issues/links:** `publicApplyProperties.js`, `styles/propertyTiles.js`.

## 2) Scope

- **In scope:** `RentalPropertyApplyTiles.jsx`, tile card layout, loading/error UI as implemented, integration with normalized tile shape.
- **Out of scope:** HAR.com availability; API uptime SLOs.

## 3) Users and stories

- As an **applicant**, I want consistent cards with photo, rent, and actions, so that I can compare listings.
- As a **developer**, I want invalid API payloads rejected at normalization, so that the UI does not render corrupt tiles.

## 4) Constraints and assumptions

- **Technical:** Required fields enforced in `normalizeApplyPropertyTile`; data source is `GET {VITE_API_BASE_URL}/api/public/apply-properties`.
- **Assumptions:** Images/links may be third-party; no in-repo guarantee of listing accuracy.

## 5) Acceptance criteria

1. Given valid tile objects, when the grid renders, then each tile shows address, rent label, photo, and outbound links as coded.
2. Given the parent passes API error state, when handled, then user sees a non-blank fallback or message per implementation.
3. Given RTL, when tiles lay out in a grid, then card content alignment respects theme direction.

## 6) Validation plan

- **Automated:** `npx vitest run src/publicApplyProperties.test.js`, Apply/tiles tests if any, `npx eslint src/`
- **Manual:** Light/dark, `/dark/apply`, RTL; verify API-backed listings when `VITE_API_BASE_URL` is set.

## 7) Implementation plan

- Baseline only. Edits: `RentalPropertyApplyTiles.jsx`, `publicApplyProperties.js`, styles under `src/styles/propertyTiles.js`.

## 8) Risks and mitigations

- **Risk:** Photo hotlink failures. **Mitigation:** Accept broken images or add placeholders when product requires.

## 9) Rollback plan

- Revert tile component or normalization changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/RentalPropertyApplyTiles.jsx`, `src/publicApplyProperties.js`
- **Tests:** `src/publicApplyProperties.test.js`, `src/components/Apply.test.jsx` (mock API tiles)
- **Acceptance criteria status:** Baseline.

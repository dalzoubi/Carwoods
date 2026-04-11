# Dark Preview Routing (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document the `/dark` and `/dark/...` synthetic routing used to force dark styling without changing real paths.
- **Why now:** Affects `Routes location`, link generation, and printable route detection.
- **Related docs/issues/links:** `routePaths.js`, `useDarkStrippedLocation` in `App.jsx`.

## 2) Scope

- **In scope:** `isDarkPreviewRoute`, `stripDarkPreviewPrefix`, `withDarkPath`, interaction with `isPortalRoute` and `isPrintablePageRoute`.
- **Out of scope:** Theme algorithm internals (see theme spec).

## 3) Users and stories

- As a **designer or QA**, I want `/dark/apply`, so that I can preview dark styling on any marketing or portal route.
- As a **developer**, I want one route config, so that I do not duplicate route trees for preview.

## 4) Constraints and assumptions

- **Technical:** `MarketingRoutes`/`PortalRoutes` receive a location whose `pathname` has `/dark` stripped for matching.
- **Assumptions:** External absolute URLs bypass `withDarkPath`.

## 5) Acceptance criteria

1. Given I visit `/dark`, when routes resolve, then content matches `/` with dark preview active.
2. Given I use `withDarkPath` from a `/dark` page, when I navigate internally, then the next URL keeps the `/dark` prefix.
3. Given `isPrintablePageRoute`, when pathname includes `/dark`, then printable detection uses stripped path per `stripDarkPreviewPrefix`.

## 6) Validation plan

- **Automated:** `npx vitest run src/routePaths.test.jsx`, `npx eslint src/`
- **Manual:** Spot-check internal links from navbar/footer/subnav under `/dark`.

## 7) Implementation plan

- Baseline only. New top-level paths: update `withDarkPath` consumers and `App.jsx` if needed.

## 8) Risks and mitigations

- **Risk:** Mixed prefixed/unprefixed state in `location`. **Mitigation:** Always derive display paths from `useLocation()` + helpers.

## 9) Rollback plan

- Revert `routePaths.js` / `App.jsx` changes.

## 10) Traceability and completion

- **Primary implementation:** `src/routePaths.js`, `src/App.jsx`, `src/components/ResponsiveNavbar.jsx`, `src/components/Footer.jsx`
- **Tests:** `src/routePaths.test.jsx`
- **Acceptance criteria status:** Baseline.

# App Routing and Shells (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document top-level routing split between marketing shell and portal shell.
- **Why now:** `App.jsx` is the integration point for paths, scroll behavior, skip link, and Analytics placement.
- **Related docs/issues/links:** `isPortalRoute`, `MarketingApp`, `PortalApp`.

## 2) Scope

- **In scope:** Route tables for marketing vs portal, `ScrollToTopOnRouteChange`, synthetic location for dark preview (`useDarkStrippedLocation`), portal vs marketing root switch.
- **Out of scope:** Server-side rewrites (hosting); deep-link auth flows beyond current `PortalAuthGate`.

## 3) Users and stories

- As a **visitor**, I want marketing pages with navbar+footer, so that the site feels cohesive.
- As a **portal user**, I want portal layout without marketing footer, so that the app feels focused.

## 4) Constraints and assumptions

- **Technical:** Portal paths normalized with `stripDarkPreviewPrefix` inside `isPortalRoute`; `/portal` deep routes as listed in `App.jsx`.
- **Assumptions:** Single SPA bundle serves both shells.

## 5) Acceptance criteria

1. Given `location.pathname` is not under `/portal`, when `App` renders, then `MarketingApp` with `ResponsiveNavbar` and `Footer` is used.
2. Given pathname is a portal route (with or without `/dark`), when `App` renders, then `PortalApp` with `PortalAuthGate` and `PortalLayout` is used.
3. Given I navigate between routes, when pathname or hash changes, then scroll-to-top behavior respects hash anchors per `ScrollToTopOnRouteChange`.

## 6) Validation plan

- **Automated:** `npx vitest run src/App.test.jsx`, `npx eslint src/`
- **Manual:** Direct loads of `/`, `/apply`, `/portal`, `/dark/portal`, deep portal routes.

## 7) Implementation plan

- Baseline only. New routes: update `App.jsx`, `PortalSidebar.jsx`, `PortalTopBar.jsx`, `routePaths.js` as applicable.

## 8) Risks and mitigations

- **Risk:** Forgetting to register a route leaves 404. **Mitigation:** Mirror marketing vs portal patterns; add tests.

## 9) Rollback plan

- Revert `App.jsx` changes; redeploy prior build.

## 10) Traceability and completion

- **Primary implementation:** `src/App.jsx`, `src/routePaths.js`, `src/index.jsx` (router host)
- **Tests:** `src/App.test.jsx`
- **Acceptance criteria status:** Baseline.

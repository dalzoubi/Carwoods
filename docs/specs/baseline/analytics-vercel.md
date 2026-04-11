# Vercel Analytics (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document inclusion of `@vercel/analytics/react` in the SPA.
- **Why now:** Baseline privacy/performance expectations for analytics script.
- **Related docs/issues/links:** `package.json` dependency, `App.jsx`.

## 2) Scope

- **In scope:** `<Analytics />` placement in `MarketingApp` and `PortalApp`, build-time bundling.
- **Out of scope:** Vercel dashboard configuration, consent banners (not implemented in baseline code).

## 3) Users and stories

- As a **product owner**, I want aggregate traffic insight on Vercel-hosted deployments, so that usage is measurable.
- As a **visitor**, I expect analytics to load only as provided by the Vercel package when deployed on Vercel.

## 4) Constraints and assumptions

- **Technical:** Component imported from `@vercel/analytics/react`; appears twice in `App.jsx` (one per shell).
- **Assumptions:** Local/dev may load script depending on Vercel integration; behavior follows vendor defaults.

## 5) Acceptance criteria

1. Given a production build, when `MarketingApp` renders, then `Analytics` is in the tree after main content shell.
2. Given `PortalApp` renders, when authenticated flow displays, then `Analytics` remains mounted as in `App.jsx`.
3. Given the dependency is present, when `npm run build` runs, then bundle includes the analytics module without errors.

## 6) Validation plan

- **Automated:** `npm run build`, `npx vitest run` (smoke)
- **Manual:** Network tab on deployed site for analytics requests (if applicable to host).

## 7) Implementation plan

- Baseline only. Removal: delete `Analytics` imports/usages and dependency (ask before dependency changes per project rules).

## 8) Risks and mitigations

- **Risk:** Privacy policy promises vs analytics. **Mitigation:** Align `Privacy` copy with actual tags.

## 9) Rollback plan

- Remove component usage or pin prior package version.

## 10) Traceability and completion

- **Primary implementation:** `src/App.jsx`, `package.json`
- **Tests:** No dedicated analytics unit tests (vendor component)
- **Acceptance criteria status:** Baseline.

# Portal Route Guard (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document role-based access for portal routes via redirect to `/portal`.
- **Why now:** Prevents tenants seeing admin-only tools and avoids premature redirects during `/me` load.
- **Related docs/issues/links:** `Role` in `domain/constants.js`, `portalUtils.js`.

## 2) Scope

- **In scope:** `PortalRouteGuard` props `allowedRoles` and optional `allow` predicate; interaction with `meStatus`.
- **Out of scope:** Server-side authorization (API still enforces permissions).

## 3) Users and stories

- As a **tenant**, I want admin URLs to bounce me home, so that I do not see forbidden UI.
- As a **user refreshing a page**, I want no flash redirect before role resolves, so that I am not sent home incorrectly.

## 4) Constraints and assumptions

- **Technical:** While `meStatus !== 'ok'`, guard renders `children` unchanged (per file comment) to avoid wrong redirects during load/error idle states.
- **Assumptions:** Role resolved from `meData` and account helpers.

## 5) Acceptance criteria

1. Given `meStatus === 'ok'` and role not in `allowedRoles`, when guard renders, then `Navigate` to `/portal` with `portalAccessDenied` state occurs.
2. Given `meStatus` is `loading` or `idle`, when guard renders, then children render without redirect.
3. Given custom `allow(role)` returns true, when `meStatus === 'ok'`, then children render even if `allowedRoles` alone would fail.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalRouteGuard.test.jsx`
- **Manual:** Hit `/portal/admin/landlords` as non-admin; observe redirect.

## 7) Implementation plan

- Baseline only. New protected route: wrap element in `PortalRouteGuard` in `App.jsx`.

## 8) Risks and mitigations

- **Risk:** Client-only guard gives false security sense. **Mitigation:** API must reject unauthorized calls (baseline assumption).

## 9) Rollback plan

- Revert guard or route wrapper changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalRouteGuard.jsx`, `src/App.jsx`, `src/domain/constants.js`, `src/portalUtils.js`
- **Tests:** `src/components/PortalRouteGuard.test.jsx`
- **Acceptance criteria status:** Baseline.

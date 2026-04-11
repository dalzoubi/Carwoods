# Portal Auth Gate (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document unauthenticated vs authenticated portal entry: Firebase init, `/me` loading, and children rendering.
- **Why now:** Prevents flashing login during token refresh and gates portal shell.
- **Related docs/issues/links:** `PortalAuthContext.jsx`, `PortalLoadingScreen.jsx`.

## 2) Scope

- **In scope:** `PortalAuthGate` branching on `authStatus` and `meStatus`, loading screen vs `PortalLoginLanding` vs children.
- **Out of scope:** Azure/Entra token exchange details (see portal auth context and `docs/portal/`).

## 3) Users and stories

- As a **signed-out user**, I want a login landing, so that I can authenticate before seeing portal data.
- As a **returning user**, I want a spinner during auth/`/me` init, so that I am not bounced to login prematurely.

## 4) Constraints and assumptions

- **Technical:** While `authStatus` is `initializing` or `authenticating`, show `PortalLoadingScreen`; after sign-in, wait for `meStatus` before showing layout (per component).
- **Assumptions:** `PortalApp` wraps `PortalLayout` with `PortalAuthGate` in `App.jsx`.

## 5) Acceptance criteria

1. Given `authStatus` is `initializing` or `authenticating`, when `PortalAuthGate` renders, then `PortalLoadingScreen` is shown (not login).
2. Given user is authenticated and `meStatus === 'loading'`, when gate renders, then loading screen is shown.
3. Given user is not authenticated after init completes, when gate renders, then `PortalLoginLanding` is shown instead of portal routes.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalAuthGate.test.jsx`, `PortalAuthContext.test.jsx`, `PortalLoadingScreen.test.jsx`
- **Manual:** Cold load `/portal`, sign-in flow, slow network throttling.

## 7) Implementation plan

- Baseline only. Changes coordinated with `PortalAuthContext.jsx` state machine.

## 8) Risks and mitigations

- **Risk:** Infinite spinner if `/me` hangs. **Mitigation:** Error states handled in context (verify timeouts/UI).

## 9) Rollback plan

- Revert gate/context changes; users fall back to prior behavior.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalAuthGate.jsx`, `src/PortalAuthContext.jsx`, `src/App.jsx`
- **Tests:** `src/components/PortalAuthGate.test.jsx`
- **Acceptance criteria status:** Baseline.

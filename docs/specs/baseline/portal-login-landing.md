# Portal Login Landing (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document the unauthenticated portal view: branding, feature bullets, social/generic sign-in, and lockout messaging.
- **Why now:** First impression for portal; integrates `usePortalAuth` and `withDarkPath` for exit links.
- **Related docs/issues/links:** `SocialSignInButtons.jsx`, `firebaseAuth.js`.

## 2) Scope

- **In scope:** `PortalLoginLanding.jsx`, loading states mirroring gate, `lockoutReason` display paths (`account_disabled`, `no_portal_access`), link back to marketing with dark prefix.
- **Out of scope:** Identity provider policy configuration in Firebase/Entra.

## 3) Users and stories

- As a **tenant or landlord**, I want clear sign-in options, so that I can access the portal.
- As a **user without portal access**, I want an explanatory message, so that I know why sign-in failed.

## 4) Constraints and assumptions

- **Technical:** Use `useTranslation()` for strings; `withDarkPath` for internal `RouterLink` targets where applicable.
- **Assumptions:** Firebase env vars drive whether auth is configured (`unconfigured` state).

## 5) Acceptance criteria

1. Given Firebase is unconfigured, when landing renders, then user sees the unconfigured messaging (per implementation) without crashing.
2. Given `lockoutReason` indicates no access, when landing renders, then appropriate alert/copy is shown.
3. Given user clicks back to marketing, when navigating, then `/dark` prefix is preserved via `withDarkPath`.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalLoginLanding.test.jsx`, `PortalSetup.test.jsx` as relevant
- **Manual:** Sign-in with test accounts; verify lockout copy; RTL.

## 7) Implementation plan

- Baseline only. Edits: landing component, `SocialSignInButtons.jsx`, locales.

## 8) Risks and mitigations

- **Risk:** OAuth popup blocked. **Mitigation:** Browser guidance in copy if product adds it.

## 9) Rollback plan

- Revert landing/auth UI commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalLoginLanding.jsx`, `src/components/SocialSignInButtons.jsx`, `src/PortalAuthContext.jsx`
- **Tests:** `src/components/PortalLoginLanding.test.jsx`
- **Acceptance criteria status:** Baseline.

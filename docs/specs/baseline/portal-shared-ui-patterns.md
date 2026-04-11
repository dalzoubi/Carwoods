# Portal Shared UI Patterns (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document cross-portal UI conventions: dialogs, snackbars, status chips, loading screens, and inline status components.
- **Why now:** Keeps portal pages visually and behaviorally consistent per `AGENTS.md` portal standards.
- **Related docs/issues/links:** `PortalConfirmDialog.jsx`, `PortalFeedbackSnackbar.jsx`, `PortalLoadingScreen.jsx`, `InlineActionStatus.jsx`, `StatusAlertSlot.jsx`.

## 2) Scope

- **In scope:** Reusable components listed above; MUI `Chip` semantic colors for statuses; `Paper variant="outlined"` for cards; sign-out confirm dialog placement rules (sidebar/navbar only).
- **Out of scope:** Marketing styled-components except where shared.

## 3) Users and stories

- As a **portal user**, I want consistent feedback for actions, so that success and failure are obvious.
- As a **developer**, I want shared primitives, so that new pages match existing portal UX quickly.

## 4) Constraints and assumptions

- **Technical:** No hard-coded hex; use MUI theme palette; `type="button"` on non-submit controls in forms.
- **Assumptions:** `PortalSignOutConfirmDialog` is not mounted in arbitrary pages.

## 5) Acceptance criteria

1. Given a destructive action, when confirm dialog is used, then actions map to primary/secondary buttons with i18n labels.
2. Given async portal action, when `InlineActionStatus` or snackbar is used, then loading/success/error states are distinguishable without color alone where feasible.
3. Given full-page auth loading, when `PortalLoadingScreen` shows, then user does not see portal nav chrome prematurely.

## 6) Validation plan

- **Automated:** Tests for `PortalLoadingScreen`, `PortalAdminAiSettings` (snackbar patterns), `PortalSignOutConfirmDialog` via navbar tests
- **Manual:** Spot-check new pages for Chip colors (`warning`/`info`/`success`) against design intent.

## 7) Implementation plan

- Baseline only. New pattern: add component under `src/components/` and reference here.

## 8) Risks and mitigations

- **Risk:** Duplicated ad-hoc alerts. **Mitigation:** Reuse `StatusAlertSlot` / snackbar helpers.

## 9) Rollback plan

- Revert shared component changes; update consumers if API changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalConfirmDialog.jsx`, `src/components/PortalFeedbackSnackbar.jsx`, `src/components/PortalLoadingScreen.jsx`, `src/components/InlineActionStatus.jsx`, `src/components/StatusAlertSlot.jsx`, `src/components/PortalSignOutConfirmDialog.jsx`
- **Tests:** `PortalLoadingScreen.test.jsx`, related portal tests
- **Acceptance criteria status:** Baseline.

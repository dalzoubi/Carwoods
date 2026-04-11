# Portal Dashboard (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Portal Team

## 1) Context

- **Problem statement:** Document the default `/portal` landing: welcome content, stats, quick actions, and recent activity patterns.
- **Why now:** Primary post-login hub; includes local `StatCard` helper component.
- **Related docs/issues/links:** `usePortalAuth`, `useMeProfile` / dashboard data hooks as wired in file.

## 2) Scope

- **In scope:** `PortalDashboard.jsx`, MUI `Paper` cards, loading placeholders, i18n strings, navigation buttons to other portal areas.
- **Out of scope:** Real-time push updates unless implemented in component.

## 3) Users and stories

- As a **signed-in user**, I want a summary dashboard, so that I can jump to requests, profile, or admin tasks.
- As a **user with slow API**, I want skeletons or spinners, so that the page does not look broken.

## 4) Constraints and assumptions

- **Technical:** Follow portal pattern: outlined `Paper`, theme colors only, no marketing shell.
- **Assumptions:** Dashboard data comes from hooks/API calls already in the component—baseline does not specify server payloads.

## 5) Acceptance criteria

1. Given I load `/portal` authenticated, when dashboard mounts, then welcome area reflects user/me data as implemented.
2. Given data is loading, when stat cards render, then `StatCard` shows loading state without layout collapse.
3. Given I use quick actions, when I navigate, then router moves to the target portal route.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PortalDashboard.test.jsx`
- **Manual:** Tenant vs landlord vs admin views; dark mode; RTL.

## 7) Implementation plan

- Baseline only. Extend dashboard by editing component and tests.

## 8) Risks and mitigations

- **Risk:** Role-specific empty states missing. **Mitigation:** Follow portal empty-state standard.

## 9) Rollback plan

- Revert dashboard commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PortalDashboard.jsx`, `src/hooks/useMeProfile.js` (if used)
- **Tests:** `src/components/PortalDashboard.test.jsx`
- **Acceptance criteria status:** Baseline.

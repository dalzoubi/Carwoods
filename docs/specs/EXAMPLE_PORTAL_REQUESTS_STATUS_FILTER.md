# Example Spec: Portal requests status filter

This is a concrete example of how to use `docs/specs/SPEC_TEMPLATE.md`.

## 1) Context

- Problem statement: Tenants and landlords cannot quickly isolate open/in-progress/resolved requests in `PortalRequests`, which slows triage and follow-up.
- Why now: Request volume is increasing and support feedback indicates list scanning is too slow.
- Related docs/issues/links:
  - `docs/portal/IMPLEMENTATION_PROMPT.md`
  - `src/components/portalRequests/RequestDetailPane.jsx`

## 2) Scope

- In scope:
  - Add status filter controls to `PortalRequests`.
  - Filter request list client-side by selected status.
  - Keep current responsive split-pane behavior (desktop side-by-side, mobile stacked).
  - Add i18n keys in `en`, `es`, `fr`, and `ar`.
- Out of scope:
  - Backend query/filter API changes.
  - New request statuses.
  - Sorting redesign.

## 3) Users and stories

- As a tenant, I want to view only open requests so I can see what still needs action.
- As a landlord/admin, I want to filter by in-progress or resolved status so I can triage work quickly.

## 4) Constraints and assumptions

- Technical constraints:
  - Use existing portal shell/components and MUI v6.
  - No hardcoded colors; use theme tokens.
  - No new dependencies.
- Product/design constraints:
  - Must follow current portal component patterns (`Paper variant="outlined"`, semantic chips).
  - Empty state text required when no results after filtering.
- Security/privacy constraints:
  - No auth/RBAC behavior changes.
  - Do not expose internal-only request metadata.
- Assumptions:
  - Request objects already include normalized `status` values (`open`, `in_progress`, `resolved`).

## 5) Acceptance criteria

1. Given the requests page has mixed statuses,
   When a user selects `Open`,
   Then only requests with status `open` are shown in the list.

2. Given the requests page has mixed statuses,
   When a user selects `In progress`,
   Then only requests with status `in_progress` are shown.

3. Given a filter is active,
   When no requests match,
   Then an empty-state message is displayed (not a blank area).

4. Given the interface language is switched to Spanish/French/Arabic,
   When the filter UI renders,
   Then all filter labels and empty-state copy appear translated.

5. Given Arabic is active (RTL),
   When the filter controls render,
   Then layout alignment and spacing remain correct without physical CSS directions.

6. Given dark mode is active (including `/dark/...` preview where relevant),
   When filter controls and results render,
   Then contrast and component styling remain readable and consistent with theme tokens.

## 6) Validation plan

- Automated checks (exact commands):
  - `npx vitest run`
  - `npx eslint src/`
- Feature tests to add/update:
  - `PortalRequests` filter behavior test for each status.
  - Empty-state test when no items match.
  - i18n render test for at least one non-English locale.
- Manual checks:
  - Desktop and mobile breakpoints for split-pane behavior.
  - Light mode + dark mode.
  - Arabic/RTL layout.
  - Verify no hard-coded English text added in JSX.

## 7) Implementation plan

- Step 1: Add status filter UI to `PortalRequests` using MUI controls with translated labels.
- Step 2: Add derived filtered list logic keyed by selected status.
- Step 3: Add empty-state text for zero matches.
- Step 4: Add/update locale keys in all four translation files.
- Step 5: Add/update unit tests covering filter behavior and empty state.

## 8) Risks and mitigations

- Risk: Status values from data source are inconsistent (e.g. `in-progress` vs `in_progress`).
  - Mitigation: Normalize statuses before filtering and add test cases for normalization.
- Risk: Filter controls regress mobile layout.
  - Mitigation: Keep controls in existing responsive container and verify at mobile breakpoint.

## 9) Rollback plan

- If regressions are discovered after deployment:
  - Disable filter UI with feature flag (if introduced), or
  - Revert filter-related commits while preserving unrelated request page improvements.

## 10) Traceability and completion

- Files changed:
  - `src/components/portalRequests/PortalRequests.jsx`
  - `src/components/portalRequests/RequestDetailPane.jsx` (if needed)
  - `src/locales/en/translation.json`
  - `src/locales/es/translation.json`
  - `src/locales/fr/translation.json`
  - `src/locales/ar/translation.json`
  - `src/components/portalRequests/*.test.jsx`
- Tests run and results:
  - `npx vitest run` -> pass
  - `npx eslint src/` -> pass (excluding known baseline lint debt, if unchanged)
- Acceptance criteria status:
  - AC-1: met / deferred (reason)
  - AC-2: met / deferred (reason)
  - AC-3: met / deferred (reason)
  - AC-4: met / deferred (reason)
  - AC-5: met / deferred (reason)
  - AC-6: met / deferred (reason)
- Follow-ups (if any):
  - Consider server-side filtering once request volume grows.

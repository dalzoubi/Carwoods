# Tenant Selection Criteria (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the tenant selection criteria informational page and its role in the Apply flow.
- **Why now:** Listed as printable route; linked from Apply subnav.
- **Related docs/issues/links:** `routePaths.js` (`PRINTABLE_PAGE_PATHS`).

## 2) Scope

- **In scope:** Route `/tenant-selection-criteria`, content structure, i18n, print + header print integration, theme/RTL.
- **Out of scope:** Legal enforceability of criteria; backend screening workflows.

## 3) Users and stories

- As an **applicant**, I want to read selection criteria before applying, so that I know eligibility expectations.
- As a **user printing the page**, I want a clean print layout, so that I can keep a copy.

## 4) Constraints and assumptions

- **Technical:** All visible strings in locale JSON; use shared layout components as implemented.
- **Assumptions:** Page is static content.

## 5) Acceptance criteria

1. Given I open `/tenant-selection-criteria`, when rendered, then content appears with marketing chrome.
2. Given printable route rules, when I use navbar print where shown, then print styles apply.
3. Given wizard/subnav links to this page, when I navigate from Apply, then routing works in light and `/dark` preview.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/TenantSelectionCriteria.test.jsx`, `npx eslint src/`
- **Manual:** Print preview, RTL, dark mode.

## 7) Implementation plan

- Baseline only. Edits: `TenantSelectionCriteria.jsx`, locales.

## 8) Risks and mitigations

- **Risk:** Outdated criteria copy. **Mitigation:** Content review outside engineering.

## 9) Rollback plan

- Revert copy/component commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/TenantSelectionCriteria.jsx`, `src/components/ApplyFlowSubnav.jsx`, `src/routePaths.js`
- **Tests:** `src/components/TenantSelectionCriteria.test.jsx`
- **Acceptance criteria status:** Baseline.

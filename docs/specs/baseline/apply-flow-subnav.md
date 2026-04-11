# Apply Flow Sub-navigation (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the Apply flow sub-navigation among Apply, criteria, and documents pages.
- **Why now:** Cross-route UX; must respect dark preview prefixing.
- **Related docs/issues/links:** `withDarkPath`, `Apply.jsx`.

## 2) Scope

- **In scope:** `ApplyFlowSubnav` component, active state, links to `/apply`, `/tenant-selection-criteria`, `/application-required-documents`.
- **Out of scope:** Portal document uploads.

## 3) Users and stories

- As an **applicant**, I want visible steps across Apply-related pages, so that I know where I am in the flow.
- As a **dark preview user**, I want subnav links to keep `/dark`, so that theme preview is stable.

## 4) Constraints and assumptions

- **Technical:** Internal links must use `withDarkPath(currentPathname, to)` pattern consistent with marketing rules.
- **Assumptions:** Subnav appears on all three routes as implemented in each page.

## 5) Acceptance criteria

1. Given I am on any Apply-flow page, when the subnav renders, then the active item reflects the current route (stripped or not per implementation).
2. Given I am under `/dark`, when I click subnav links, then destination URLs retain `/dark` prefix.
3. Given RTL layout, when I view subnav, then spacing/icons mirror per MUI direction and logical CSS.

## 6) Validation plan

- **Automated:** Tests on pages that mount subnav (`Apply.test.jsx`, others as present), `npx eslint src/`
- **Manual:** Click-through all three routes in light and `/dark`, Arabic.

## 7) Implementation plan

- Baseline only. Edits: `ApplyFlowSubnav.jsx`, consuming pages, `routePaths.js` if routes change.

## 8) Risks and mitigations

- **Risk:** New Apply step added without subnav update. **Mitigation:** Extend subnav + routes together.

## 9) Rollback plan

- Revert subnav component changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/ApplyFlowSubnav.jsx`, `src/components/Apply.jsx`, `src/components/TenantSelectionCriteria.jsx`, `src/components/ApplicationRequiredDocuments.jsx`, `src/routePaths.js`
- **Tests:** Co-located page tests
- **Acceptance criteria status:** Baseline.

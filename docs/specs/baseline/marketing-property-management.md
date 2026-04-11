# Marketing Property Management (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the public property management marketing page.
- **Why now:** Baseline for owner-focused content and print behavior.
- **Related docs/issues/links:** `routePaths.js` (`PRINTABLE_PAGE_PATHS`).

## 2) Scope

- **In scope:** Route `/property-management`, TOC/layout if used, i18n, theme-compliant styling, header print affordance when route is printable.
- **Out of scope:** Authenticated landlord operational tools (portal).

## 3) Users and stories

- As a **property owner**, I want to read management services and requirements, so that I can decide to contact Carwoods.
- As a **user printing the page**, I want a sensible print layout, so that the document is readable on paper.

## 4) Constraints and assumptions

- **Technical:** Page is part of marketing shell; may use `TocPageLayout` / scroll spy patterns.
- **Assumptions:** Content is static; no live portfolio API on this page.

## 5) Acceptance criteria

1. Given I navigate to `/property-management`, when the page loads, then content appears with marketing chrome.
2. Given this route is in `PRINTABLE_PAGE_PATHS`, when I use header print (where enabled), then print rules in `index.css` / print components apply.
3. Given Arabic locale, when I view the page, then logical CSS/RTL rules do not break the layout.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/PropertyManagement.test.jsx`, `npx eslint src/`
- **Manual:** Light/dark, `/dark/property-management`, RTL, browser print preview.

## 7) Implementation plan

- Baseline only. Future edits: `PropertyManagement.jsx`, locales, print-related styles if needed.

## 8) Risks and mitigations

- **Risk:** Long TOC pages break mobile. **Mitigation:** Test `sm`/`md` breakpoints.

## 9) Rollback plan

- Revert page changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/PropertyManagement.jsx`, `src/routePaths.js` (print routing)
- **Tests:** `src/components/PropertyManagement.test.jsx`
- **Acceptance criteria status:** Baseline.

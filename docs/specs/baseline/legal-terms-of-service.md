# Terms of Service (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the Terms of Service page baseline.
- **Why now:** Align legal pages with shared TOC/layout and i18n rules.
- **Related docs/issues/links:** Same patterns as Privacy/Accessibility.

## 2) Scope

- **In scope:** Route `/terms-of-service`, page structure, i18n, marketing shell, theme/RTL.
- **Out of scope:** Jurisdiction-specific legal enforcement outside site copy.

## 3) Users and stories

- As a **visitor**, I want to read binding terms in my language when translated, so that I understand site rules.
- As a **screen reader user**, I want logical heading order, so that the document is navigable.

## 4) Constraints and assumptions

- **Technical:** `useTranslation()` for visible strings; MUI/theme for surfaces.
- **Assumptions:** Terms content lives per current `TermsOfService.jsx` + locale bundles.

## 5) Acceptance criteria

1. Given I open `/terms-of-service`, when the page loads, then it renders inside the marketing layout with footer/nav.
2. Given I switch language, when translations exist, then visible terms-related strings update.
3. Given `/dark/terms-of-service`, when loaded, then dark preview routing strips correctly for route matching (see `useDarkStrippedLocation`).

## 6) Validation plan

- **Automated:** `npx eslint src/` (no dedicated `TermsOfService.test.jsx` in baseline tree).
- **Manual:** Light/dark, `/dark/...`, RTL, link from footer/nav.

## 7) Implementation plan

- Baseline only. Edits: `src/components/TermsOfService.jsx`, locales.

## 8) Risks and mitigations

- **Risk:** Missing tests for ToS-only regressions. **Mitigation:** Add co-located test when changing structure.

## 9) Rollback plan

- Revert content/layout commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/TermsOfService.jsx`, `src/App.jsx` (route), `src/locales/*/translation.json`
- **Tests:** Add co-located tests when behavior becomes non-trivial; none required for static baseline.
- **Acceptance criteria status:** Baseline.

# Accessibility Statement (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the Accessibility Statement page and WCAG-minded expectations for the site.
- **Why now:** Baseline for compliance messaging and a11y test hooks.
- **Related docs/issues/links:** `src/components/Accessibility.test.jsx`, `App.a11y.test.jsx`.

## 2) Scope

- **In scope:** Route `/accessibility`, statement content via i18n, layout consistent with other legal/marketing pages.
- **Out of scope:** Third-party audit certification; remediation of all third-party embeds.

## 3) Users and stories

- As a **user with disabilities**, I want to read how Carwoods addresses accessibility, so that I know how to get help.
- As a **QA engineer**, I want tests that cover skip links and key landmarks, so that regressions are caught.

## 4) Constraints and assumptions

- **Technical:** Follow project rules for `aria-*`, language menus, and contrast tokens.
- **Assumptions:** Statement text is maintained in translation files.

## 5) Acceptance criteria

1. Given I open `/accessibility`, when the page renders, then content uses `useTranslation()` keys, not raw English in JSX.
2. Given the marketing app shell, when I Tab from the top, then skip-to-main is available (see `App.jsx`).
3. Given RTL locale, when I view the statement, then layout uses logical properties / theme direction as elsewhere.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Accessibility.test.jsx src/App.a11y.test.jsx`, `npx eslint src/`
- **Manual:** axe or Lighthouse spot-check on the page in light/dark.

## 7) Implementation plan

- Baseline only. Updates: `Accessibility.jsx`, locales, tests when copy changes.

## 8) Risks and mitigations

- **Risk:** Statement promises exceed product reality. **Mitigation:** Keep copy aligned with tested behaviors.

## 9) Rollback plan

- Revert copy/component changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Accessibility.jsx`, `src/locales/*/translation.json`
- **Tests:** `src/components/Accessibility.test.jsx`, `src/App.a11y.test.jsx`
- **Acceptance criteria status:** Baseline.

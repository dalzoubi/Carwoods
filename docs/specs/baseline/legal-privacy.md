# Privacy Policy (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the static Privacy Policy page and its presentation requirements.
- **Why now:** Legal content must stay consistent with site chrome and accessibility.
- **Related docs/issues/links:** `TocPageLayout.jsx`, `useTocScrollSpy.js`.

## 2) Scope

- **In scope:** Route `/privacy`, structure/headings, i18n, navigation within page (TOC if present), theme/RTL.
- **Out of scope:** Legal review workflow; hosting of policy versions outside the repo.

## 3) Users and stories

- As a **visitor**, I want to read the privacy policy with clear headings, so that I understand data practices.
- As a **keyboard user**, I want focusable in-page navigation, so that I can jump to sections.

## 4) Constraints and assumptions

- **Technical:** No hard-coded English; use translation keys for all visible strings.
- **Assumptions:** Policy text is maintained in locale files or composed per current component pattern.

## 5) Acceptance criteria

1. Given I open `/privacy`, when the page renders, then content is available in the active locale (fallback rules per i18next).
2. Given the page uses TOC layout, when I activate a section link, then the view scrolls to the corresponding anchor.
3. Given dark mode, when I read the policy, then text/background contrast follows theme tokens.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Privacy.test.jsx`, `npx eslint src/`
- **Manual:** Light/dark, RTL, heading hierarchy sanity check.

## 7) Implementation plan

- Baseline only. Updates: `Privacy.jsx`, `src/locales/*/translation.json`.

## 8) Risks and mitigations

- **Risk:** Legal copy desync across languages. **Mitigation:** Coordinate translations; note intentional fallbacks.

## 9) Rollback plan

- Revert content commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Privacy.jsx`, `src/locales/{en,es,fr,ar}/translation.json`
- **Tests:** `src/components/Privacy.test.jsx`
- **Acceptance criteria status:** Baseline.

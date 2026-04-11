# Internationalization and RTL (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document i18next setup, four locales, and RTL handling for Arabic.
- **Why now:** All user-visible marketing/portal strings must flow through translations.
- **Related docs/issues/links:** `i18n.js`, `LanguageContext.jsx`, `languagePreferenceStorage.js`.

## 2) Scope

- **In scope:** `src/locales/{en,es,fr,ar}/translation.json`, `useTranslation`, `LanguageProvider`, `html lang`/`dir`, Arabic font stack in `index.css`, test reset pattern in `setupTests.js`.
- **Out of scope:** Professional translation workflow; CMS-driven copy.

## 3) Users and stories

- As a **Spanish speaker**, I want UI in Spanish, so that I can use the site comfortably.
- As an **Arabic speaker**, I want RTL layout, so that reading order matches my language.

## 4) Constraints and assumptions

- **Technical:** Never hard-code English in JSX for user-visible text; add keys to all four locale files when adding strings.
- **Assumptions:** Tests that change language reset with `i18n.changeLanguage('en')` in `beforeEach` per `AGENTS.md`.

## 5) Acceptance criteria

1. Given the app boots, when `i18n` initializes, then all four bundles are registered as in `i18n.js`.
2. Given I switch to Arabic, when `LanguageContext` updates, then `document.documentElement` has `dir="rtl"` and Arabic font stack applies.
3. Given a new translation key, when any locale file is missing the key, then i18next fallback behavior matches project expectations (usually English).

## 6) Validation plan

- **Automated:** `npx vitest run src/LanguageContext.test.jsx src/languagePreferenceStorage.test.js`, `npx eslint src/`
- **Manual:** Switch each language on key pages; verify no mirrored-only bugs in custom styled-components.

## 7) Implementation plan

- Baseline only. New strings: update all four JSON files; prefer split keys for inline links (see `contact.*` pattern).

## 8) Risks and mitigations

- **Risk:** Cross-test language bleed. **Mitigation:** Reset `i18n` language in tests that mutate it.

## 9) Rollback plan

- Revert locale or provider changes.

## 10) Traceability and completion

- **Primary implementation:** `src/i18n.js`, `src/LanguageContext.jsx`, `src/languagePreferenceStorage.js`, `src/locales/*/translation.json`, `src/index.css` (RTL)
- **Tests:** `src/LanguageContext.test.jsx`, `src/languagePreferenceStorage.test.js`, `src/setupTests.js`
- **Acceptance criteria status:** Baseline.

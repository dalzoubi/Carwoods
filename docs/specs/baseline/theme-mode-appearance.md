# Theme Mode and Appearance (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document light/dark/system theme resolution, persistence, and Emotion RTL cache integration.
- **Why now:** Central to all UI; interacts with LanguageProvider order.
- **Related docs/issues/links:** `ThemeModeContext.jsx`, `theme.js`, `themePreferenceStorage.js`.

## 2) Scope

- **In scope:** `ThemeModeProvider`, effective mode (system vs override vs `/dark` preview), `buildTheme`, `applyThemeCssVariables`, appearance menu in navbar.
- **Out of scope:** User account sync of theme (none in static site).

## 3) Users and stories

- As a **user**, I want to pick light, dark, or system appearance, so that the site matches my preference.
- As an **Arabic reader**, I want RTL Emotion cache when Arabic is active, so that styled output mirrors correctly.

## 4) Constraints and assumptions

- **Technical:** `LanguageProvider` must wrap `ThemeModeProvider`; do not pass `isRTL` into `ThemeModeProvider` as a prop (reads `useLanguage()` internally).
- **Assumptions:** `/dark` preview overrides stored mode while on preview paths.

## 5) Acceptance criteria

1. Given I change appearance in the menu, when selection persists, then reload restores preference via storage helper.
2. Given `/dark` preview, when I view pages, then effective mode is dark regardless of stored light preference (per implementation).
3. Given theme switches, when variables update, then styled-components reading `var(--palette-*)` reflect new values.

## 6) Validation plan

- **Automated:** `npx vitest run src/themePreferenceStorage.test.js`, related context tests, `npx eslint src/`
- **Manual:** Toggle system dark/light at OS level; exercise `/dark` exit via appearance menu.

## 7) Implementation plan

- Baseline only. Edits: `ThemeModeContext.jsx`, `theme.js`, `vite.config.js` if boot script tied to dark flag.

## 8) Risks and mitigations

- **Risk:** Flash of wrong theme on load. **Mitigation:** HTML injection path in Vite when dark feature enabled.

## 9) Rollback plan

- Revert theme context or `buildTheme` changes; clear local storage if schema changes.

## 10) Traceability and completion

- **Primary implementation:** `src/ThemeModeContext.jsx`, `src/theme.js`, `src/themePreferenceStorage.js`, `src/index.jsx`
- **Tests:** `src/themePreferenceStorage.test.js`, `LanguageContext.test.jsx` (ordering interactions as covered)
- **Acceptance criteria status:** Baseline.

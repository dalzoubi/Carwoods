# Responsive Navbar (baseline)

## Metadata

- **Priority:** P0
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the marketing header: navigation, language menu, appearance (theme) menu, account/portal entry, and print control.
- **Why now:** Primary chrome for marketing; complex responsive and a11y requirements.
- **Related docs/issues/links:** `ThemeModeContext.jsx`, `LanguageContext.jsx`, `routePaths.js`.

## 2) Scope

- **In scope:** Desktop + mobile drawer patterns, i18n, RTL, dark preview link prefixing, print button visibility on printable routes, sign-out confirm dialog placement rules.
- **Out of scope:** Portal `PortalTopBar` / sidebar (separate spec).

## 3) Users and stories

- As a **mobile user**, I want a hamburger menu, so that I can reach all nav items.
- As a **visitor**, I want language and theme controls with proper `aria-*`, so that assistive tech announces state correctly.

## 4) Constraints and assumptions

- **Technical:** Language icon buttons must expose `aria-label`, `aria-haspopup`, `aria-expanded`, `aria-controls`; language items use `lang` attribute.
- **Assumptions:** `isPrintablePageRoute` gates header print UI.

## 5) Acceptance criteria

1. Given a printable marketing route (per `routePaths.js`), when I view the header, then print affordance is shown as implemented.
2. Given I open the language menu, when I select a locale, then `html` `lang`/`dir` update and content re-renders translated.
3. Given `/dark` preview, when I use internal `NavLink`s, then targets stay prefixed via `withDarkPath`.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/ResponsiveNavbar.test.jsx src/components/ResponsiveNavbar.signout.test.jsx`, `npx eslint src/`
- **Manual:** Light/dark/system, `/dark/`, Arabic RTL, keyboard-only nav, focus traps in mobile menu.

## 7) Implementation plan

- Baseline only. Edits: `ResponsiveNavbar.jsx`, related dialogs, locales, `routePaths.js`.

## 8) Risks and mitigations

- **Risk:** z-index/focus conflicts with MUI `Menu`/`Drawer`. **Mitigation:** Follow existing MUI patterns and test mobile.

## 9) Rollback plan

- Revert navbar-related commits.

## 10) Traceability and completion

- **Primary implementation:** `src/components/ResponsiveNavbar.jsx`, `src/components/PortalSignOutConfirmDialog.jsx` (shared sign-out), `src/routePaths.js`
- **Tests:** `ResponsiveNavbar.test.jsx`, `ResponsiveNavbar.signout.test.jsx`
- **Acceptance criteria status:** Baseline.

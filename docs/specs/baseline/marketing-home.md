# Marketing Home (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Establish the documented baseline for the public landing experience at `/` (and `/dark` preview).
- **Why now:** Central reference for marketing IA and regression scope.
- **Related docs/issues/links:** `docs/specs/SPEC_TEMPLATE.md`, `AGENTS.md`.

## 2) Scope

- **In scope:** Hero, primary CTAs, content sections, internal navigation from Home, i18n strings, light/dark/theming via shared shell.
- **Out of scope:** Portal flows, server-rendered SEO beyond static Vite build, backend listing data (Apply tiles are separate).

## 3) Users and stories

- As a **prospective tenant or owner**, I want a clear overview of Carwoods and next steps, so that I can navigate to Apply, Property Management, or Contact.
- As a **visitor in Arabic**, I want RTL layout, so that the page reads naturally.

## 4) Constraints and assumptions

- **Technical:** React 18 + React Router; strings via `useTranslation()`; no hard-coded English in JSX.
- **Product/design:** Must match marketing shell (navbar + footer) and theme tokens.
- **Assumptions:** Home is static; no client API required for initial render.

## 5) Acceptance criteria

1. Given I open `/`, when the app loads, then I see the Home content inside the marketing `Container`/`Content` with skip link and `#page-top` sentinel.
2. Given I use the language switcher, when I pick a locale, then visible Home copy updates and `html` `lang`/`dir` reflect the selection.
3. Given dark mode or `/dark`, when I view Home, then surfaces use theme/CSS variables without hard-coded light-only colors.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Home.test.jsx`, `npx eslint src/`
- **Manual:** Light, dark, `/dark/`, Arabic RTL, keyboard skip-to-main, resize breakpoints.

## 7) Implementation plan

- Baseline documentation only. Future changes: edit `src/components/Home.jsx`, locale files, and associated tests.

## 8) Risks and mitigations

- **Risk:** Copy drift across locales. **Mitigation:** Add keys to all four `translation.json` files together.

## 9) Rollback plan

- Revert commits touching Home or revert deployment; no migration.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Home.jsx`, `src/locales/{en,es,fr,ar}/translation.json`
- **Tests:** `src/components/Home.test.jsx`
- **Acceptance criteria status:** Baseline — mark per change when Home is modified.

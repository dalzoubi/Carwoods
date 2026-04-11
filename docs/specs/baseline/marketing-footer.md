# Marketing Footer (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document sitewide marketing footer links, branding, and theme behavior.
- **Why now:** Footer is shared across all marketing routes; changes have broad blast radius.
- **Related docs/issues/links:** `AGENTS.md` (contrast, tokens).

## 2) Scope

- **In scope:** `Footer` component, internal links (with `withDarkPath` where required), external links, i18n labels, print hiding rules.
- **Out of scope:** Portal chrome (portal uses separate layout).

## 3) Users and stories

- As a **visitor**, I want quick links to legal pages and contact, so that I can find policies and support.
- As a **dark preview user**, I want footer links to stay under `/dark/...`, so that preview mode persists.

## 4) Constraints and assumptions

- **Technical:** Use `withDarkPath` for internal navigation from marketing shell; semantic footer colors per theme variables.
- **Assumptions:** Footer renders only in `MarketingApp` (`App.jsx`).

## 5) Acceptance criteria

1. Given any marketing route, when the page renders, then the footer appears below `Content` with expected links.
2. Given I am on `/dark/apply`, when I follow an internal footer link, then navigation preserves `/dark` prefix per `withDarkPath`.
3. Given print CSS, when I print a marketing page, then footer is hidden per global print rules (`index.css` / component styles).

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Footer.test.jsx`, `npx eslint src/`
- **Manual:** Light/dark contrast check on footer bar, RTL, several routes.

## 7) Implementation plan

- Baseline only. Edits: `Footer.jsx`, `routePaths.js` if link rules change, locales.

## 8) Risks and mitigations

- **Risk:** Broken internal link when adding routes. **Mitigation:** Update `withDarkPath` consumers and `App.jsx` routes together.

## 9) Rollback plan

- Revert `Footer.jsx` / locale changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/Footer.jsx`, `src/routePaths.js`, `src/App.jsx`
- **Tests:** `src/components/Footer.test.jsx`
- **Acceptance criteria status:** Baseline.

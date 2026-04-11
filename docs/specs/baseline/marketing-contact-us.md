# Marketing Contact Us (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the public contact page: copy, internal link to Apply, and external CTA to the HAR agent profile.
- **Why now:** Baseline for how prospects reach the licensed agent; page is static (no in-app form submit).
- **Related docs/issues/links:** `contact.*` keys in locale files, `withDarkPath`.

## 2) Scope

- **In scope:** Route `/contact-us`, `Helmet` title/description, paragraphs via i18n, styled internal `Link` to Apply, external `Button` opening `HAR_AGENT_URL` in a new tab with `rel="noopener noreferrer"`.
- **Out of scope:** Contact form POST, CRM webhooks, spam filtering.

## 3) Users and stories

- As a **visitor**, I want clear contact guidance and a link to Apply, so that I know next steps.
- As a **visitor**, I want a labeled external CTA, so that I can open the agent profile on HAR.com confidently.

## 4) Constraints and assumptions

- **Technical:** `contactValidation.js` exists in repo but is not used by this page’s baseline UI; do not assume a form without verifying imports.
- **Assumptions:** HAR URL constant in `ContactUs.jsx` is the canonical outbound destination.

## 5) Acceptance criteria

1. Given I open `/contact-us`, when the page renders, then heading and paragraphs use `t('contact.*')` keys.
2. Given I follow the Apply inline link, when I am in `/dark` preview, then `withDarkPath` keeps the `/dark` prefix on the destination.
3. Given I activate the HAR CTA, when the browser opens the tab, then `target="_blank"` and `aria-label` from `contact.ctaAriaLabel` apply.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/ContactUs.test.jsx`, `npx eslint src/`
- **Manual:** Light/dark, RTL, keyboard focus on links/button, external link opens correctly.

## 7) Implementation plan

- Baseline only. Copy changes: four locale files + `ContactUs.jsx` if URL changes.

## 8) Risks and mitigations

- **Risk:** Stale HAR URL. **Mitigation:** Single constant in component; update when agent profile moves.

## 9) Rollback plan

- Revert `ContactUs.jsx` / locale changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/ContactUs.jsx`, `src/locales/{en,es,fr,ar}/translation.json`
- **Tests:** `src/components/ContactUs.test.jsx`
- **Acceptance criteria status:** Baseline.

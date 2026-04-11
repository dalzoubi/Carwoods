# Applicant Wizard (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the multi-step applicant wizard embedded in the Apply experience.
- **Why now:** Complex UI with chips, dialogs, and extensive copy; translation debt called out in `AGENTS.md`.
- **Related docs/issues/links:** `ApplicantWizard.jsx`, wizard `QUESTIONS` data.

## 2) Scope

- **In scope:** Wizard UI flow on the client, personalization card, print button behavior inside wizard where implemented, MUI dialogs.
- **Out of scope:** Server-side storage of wizard answers unless/until integrated; backend underwriting.

## 3) Users and stories

- As an **applicant**, I want guided questions, so that I understand what information matters.
- As a **translator**, I want wizard strings routed through i18n, so that all locales stay aligned (ongoing effort per AGENTS note).

## 4) Constraints and assumptions

- **Technical:** `buildChipLabel` and `QUESTIONS` may contain English — baseline acknowledges current state; new work should prefer `useTranslation`.
- **Assumptions:** Wizard state is client-only unless extended.

## 5) Acceptance criteria

1. Given I open the wizard from Apply, when I step through questions, then navigation controls use `type="button"` where non-submit.
2. Given I use print inside wizard regions, when print CSS applies, then wizard chrome hidden per existing print rules.
3. Given dark mode, when dialogs and cards open, then backgrounds use MUI theme (e.g. `backgroundImage: 'none'` on Paper where needed).

## 6) Validation plan

- **Automated:** `npx vitest run src/components/Apply.test.jsx` (wizard exercised via Apply where covered); `npx eslint src/components/ApplicantWizard.jsx`
- **Manual:** Full happy path, keyboard, light/dark, RTL spot-check, print preview.

## 7) Implementation plan

- Baseline only. Future: migrate hard-coded strings to i18n per `AGENTS.md`.

## 8) Risks and mitigations

- **Risk:** Untranslated wizard copy in non-English locales. **Mitigation:** Track keys and fallbacks explicitly.

## 9) Rollback plan

- Revert wizard commits; state is not persisted server-side in baseline.

## 10) Traceability and completion

- **Primary implementation:** `src/components/ApplicantWizard.jsx`, `src/components/Apply.jsx`, `src/styles.js` (print/personalize patterns)
- **Tests:** No dedicated `ApplicantWizard.test.jsx` in baseline; coverage via Apply and manual QA.
- **Acceptance criteria status:** Baseline (note partial i18n coverage in code).

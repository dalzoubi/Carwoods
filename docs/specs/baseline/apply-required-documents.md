# Application Required Documents (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document the required documents checklist page for applicants.
- **Why now:** Printable route; part of Apply IA.
- **Related docs/issues/links:** `PRINTABLE_PAGE_PATHS`.

## 2) Scope

- **In scope:** Route `/application-required-documents`, i18n, layout, print behavior, links from Apply flow.
- **Out of scope:** Document upload to a backend (not defined on this static marketing page unless added elsewhere).

## 3) Users and stories

- As an **applicant**, I want a clear checklist of documents, so that I can prepare before applying.
- As a **printer**, I want the checklist to print readably, so that I can reference it offline.

## 4) Constraints and assumptions

- **Technical:** No hard-coded English; follow logical CSS for RTL lists.
- **Assumptions:** Content maintained in translations.

## 5) Acceptance criteria

1. Given I open `/application-required-documents`, when the page loads, then checklist content displays per locale.
2. Given the route is printable, when I print, then global print rules hide chrome and show readable body content.
3. Given `/dark/application-required-documents`, when loaded, then dark styling is consistent with theme tokens.

## 6) Validation plan

- **Automated:** `npx vitest run src/components/ApplicationRequiredDocuments.test.jsx`, `npx eslint src/`
- **Manual:** Print preview, RTL, mobile readability.

## 7) Implementation plan

- Baseline only. Edits: `ApplicationRequiredDocuments.jsx`, locales.

## 8) Risks and mitigations

- **Risk:** List semantics for assistive tech. **Mitigation:** Use appropriate list/heading structure in JSX.

## 9) Rollback plan

- Revert content changes.

## 10) Traceability and completion

- **Primary implementation:** `src/components/ApplicationRequiredDocuments.jsx`, `src/routePaths.js`
- **Tests:** `src/components/ApplicationRequiredDocuments.test.jsx`
- **Acceptance criteria status:** Baseline.

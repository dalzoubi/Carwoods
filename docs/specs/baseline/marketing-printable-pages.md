# Marketing Printable Pages (baseline)

## Metadata

- **Priority:** P2
- **Owner:** Marketing Team

## 1) Context

- **Problem statement:** Document which marketing routes expose header print controls and how print CSS behaves.
- **Why now:** `PRINTABLE_PAGE_PATHS` is the single source for printable routes and navbar UI.
- **Related docs/issues/links:** `routePaths.js`, `ResponsiveNavbar.jsx`, `index.css`, `styles/print.js`.

## 2) Scope

- **In scope:** Routes: tenant selection criteria, application required documents, property management (per `PRINTABLE_PAGE_PATHS`); print button visibility; global print rules.
- **Out of scope:** PDF generation server-side; portal document printing unless added later.

## 3) Users and stories

- As a **user**, I want to print long reference pages without nav clutter, so that I get a clean document.
- As a **RTL reader**, I want print padding and alignment to use logical properties, so that printed Arabic layout is correct.

## 4) Constraints and assumptions

- **Technical:** `isPrintablePageRoute` must account for `/dark` prefix via `stripDarkPreviewPrefix`.
- **Assumptions:** `PrintHeader` and invert filter for logo apply on print per existing CSS.

## 5) Acceptance criteria

1. Given I am on a path in `PRINTABLE_PAGE_PATHS` (with or without `/dark`), when the navbar renders, then print control is available as implemented.
2. Given I open print preview on those pages, when global print CSS applies, then marketing chrome is hidden.
3. Given wizard/personalize UI on Apply, when printing, then interactive-only blocks stay hidden per existing rules.

## 6) Validation plan

- **Automated:** `npx vitest run src/routePaths.test.jsx`, navbar tests touching print flag
- **Manual:** Browser print preview for all three routes, light + dark screen before print.

## 7) Implementation plan

- Baseline only. New printable page: add to `PRINTABLE_PAGE_PATHS`, navbar, and verify print CSS.

## 8) Risks and mitigations

- **Risk:** Empty `#page-top` sentinel prints as visible artifact. **Mitigation:** Hide sentinel in print if observed.

## 9) Rollback plan

- Revert `routePaths` or print CSS changes.

## 10) Traceability and completion

- **Primary implementation:** `src/routePaths.js`, `src/components/ResponsiveNavbar.jsx`, `src/index.css`, `src/styles/print.js`, `src/styles.js` (`PrintHeader`)
- **Tests:** `src/routePaths.test.jsx`
- **Acceptance criteria status:** Baseline.

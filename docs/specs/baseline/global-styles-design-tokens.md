# Global Styles and Design Tokens (baseline)

## Metadata

- **Priority:** P1
- **Owner:** Platform Team

## 1) Context

- **Problem statement:** Document global styling: `styles.js`, modular styles under `src/styles/`, and CSS variables from `applyThemeCssVariables`.
- **Why now:** Tokens drive marketing + portal appearance; violations cause dark/RTL/print bugs.
- **Related docs/issues/links:** `theme.js`, `AGENTS.md` theming section.

## 2) Scope

- **In scope:** Shared styled-components, semantic variables (`--cta-button-*`, `--nav-chrome-*`, etc.), `index.css` global + print rules, logical CSS properties policy.
- **Out of scope:** Complete design system documentation outside code.

## 3) Users and stories

- As a **developer**, I want semantic CSS variables, so that I do not hard-code hex in components.
- As a **print user**, I want print rules to hide chrome and force readable paper colors, so that output is usable.

## 4) Constraints and assumptions

- **Technical:** Prefer `var(--palette-*)` / dedicated tokens; use logical properties (`margin-inline-start`) not physical left/right in new CSS.
- **Assumptions:** `PrintHeader` and global `@media print` live in `index.css` / `styles.js` as implemented.

## 5) Acceptance criteria

1. Given theme mode changes, when `applyThemeCssVariables` runs, then document root exposes variables consumed by `styles.js`.
2. Given `@media print`, when printing a marketing page, then header/nav/footer hiding rules apply per `index.css`.
3. Given new styled-component surfaces, when authored, then they avoid hard-coded `#fff`/`#1976` style literals (grep gate for changes).

## 6) Validation plan

- **Automated:** `npx eslint src/` (note existing `no-restricted-globals` in `styles.js`), `npx vitest run`
- **Manual:** Print preview for representative pages; dark mode on components using shared styles.

## 7) Implementation plan

- Baseline only. New tokens: add next to related ones in `applyThemeCssVariables`.

## 8) Risks and mitigations

- **Risk:** Token explosion without naming convention. **Mitigation:** Group by feature (nav, footer, CTA).

## 9) Rollback plan

- Revert `theme.js` / `styles.js` / `index.css` commits.

## 10) Traceability and completion

- **Primary implementation:** `src/theme.js`, `src/styles.js`, `src/index.css`, `src/styles/*.js`
- **Tests:** Visual/manual; limited automated coverage for CSS variables
- **Acceptance criteria status:** Baseline.

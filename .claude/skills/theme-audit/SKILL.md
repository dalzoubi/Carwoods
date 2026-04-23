---
name: theme-audit
description: Scan touched files for hardcoded hex colors, physical CSS directions (margin-left etc.), and light-only inline styles in shared flows, and propose replacements using MUI theme tokens, CSS variables in applyThemeCssVariables, and logical CSS. Use when the user adds or changes UI and wants to confirm dark-mode / RTL / print safety before shipping.
---

# Theme Audit

## Purpose

Catch the four most common theming regressions before they ship:

1. Hardcoded hex colors that break dark mode
2. Physical CSS directions (`margin-left`, `padding-right`) that break RTL
3. Light-only inline styles in shared flows (dialogs, wizards, cards, nav)
4. New MUI Paper surfaces without `backgroundImage: 'none'` that look wrong in dark elevation

## Inputs to read first

1. `AGENTS.md` → "Theming & styling" section
2. `src/CLAUDE.md`
3. `src/theme.js` (especially `applyThemeCssVariables`) — the registry of semantic tokens
4. `src/index.css` — global + print rules
5. The changed files (from `git diff` or user-specified paths)

## Workflow

1. **Identify scope**. Ask the user which files or run `git diff --name-only` if on a feature branch. Limit the audit to those files plus any shared components they import.
2. **Scan for hex literals**:
   - Grep for `#[0-9a-fA-F]{3,8}` in changed JSX/styled-components
   - Allow-list: asset paths, test fixtures, `src/theme.js` itself, `src/index.css` print rules where noted
3. **Scan for physical CSS directions**:
   - Grep for `margin-left`, `margin-right`, `padding-left`, `padding-right`, `border-left`, `border-right`, `left:` / `right:` in styled-components and print rules
   - In JS inline styles, grep for `marginLeft`, `marginRight`, `paddingLeft`, `paddingRight`
   - Replace with `margin-inline-start` / `margin-inline-end` (CSS) or `marginInlineStart` / `marginInlineEnd` (JS objects)
4. **Scan for light-only inline styles** in shared flows (dialogs, wizards, cards, nav):
   - Look for `backgroundColor: '#...'`, `color: '#...'` in components used across the app
   - Propose `sx` with theme tokens or `alpha(theme.palette.*, n)`
5. **New MUI Paper-based surfaces**:
   - Confirm `backgroundImage: 'none'` is applied where dark elevation would otherwise tint the surface
6. **Chrome tokens**:
   - Flag any use of `--button-on-primary` or `--footer-on-primary` outside app chrome; those are reserved
   - For arbitrary "button on color X" patterns, use `theme.palette.getContrastText(bg)` or propose a new dedicated token in `applyThemeCssVariables`

## Output format

```markdown
## Findings

### Hardcoded hex
- `src/components/Foo.jsx:42` — `#1976d2` → suggest `theme.palette.primary.main` via `sx` or add `--palette-primary-main` var if styled-components

### Physical CSS directions
- `src/components/Bar.jsx:88` — `margin-left: 8px` → `margin-inline-start: 8px`

### Light-only inline styles
- `src/components/Baz.jsx:120` — `style={{ background: '#fff' }}` on Dialog content → `sx={{ bgcolor: 'background.paper' }}`

### Missing `backgroundImage: 'none'`
- `src/components/Qux.jsx:15` — new `<Paper>` — add `backgroundImage: 'none'` to avoid dark elevation tint

## Proposed new variables
- `--some-new-token` under `applyThemeCssVariables` (next to `--palette-app-chrome-*`) — used by `<Foo>` in dark mode
```

## Post-audit verification checklist

After applying fixes, instruct the user to verify:

1. Light mode
2. Dark mode
3. `/dark/…` preview for affected pages
4. Print preview
5. At least one RTL locale (`ar`) if spacing/layout changed
6. `npx vitest run`
7. `npm run build` if Vite HTML injection or env handling changed

## Guardrails

- Do not silently rewrite code — propose replacements and confirm with the user for shared components
- Do not touch the two pre-existing `no-restricted-globals` errors in `src/styles.js` (`history`) — not regressions
- Print rules must use logical properties too — RTL documents print via the same rules

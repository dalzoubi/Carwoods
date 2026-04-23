# src/ — Claude scope

Applies to source files under `src/`. Read AGENTS.md "Theming & styling" and "Portal UX standards" before structural changes. Translations have their own scoped rules in `src/locales/CLAUDE.md`.

## Color system

- **MUI components**: use `useTheme()`, `sx`, or theme component overrides. No hardcoded hex in JSX.
- **Styled-components**: consume CSS variables (`var(--palette-…)`, `var(--cta-button-…)`, `var(--nav-chrome-…)`, `var(--footer-…)`, `var(--menu-item-…)`).
- **New variables**: add them in `applyThemeCssVariables` in `src/theme.js` next to related tokens. Do not scatter hex across files.
- **Contrast**: use `theme.palette.getContrastText(bg)` or a dedicated token. `--button-on-primary` and `--footer-on-primary` are for **app chrome only** — do not repurpose them for arbitrary `primary.main` fills.

## Dark mode

- No light-only inline styles in shared flows (dialogs, wizards, cards, nav).
- MUI surfaces (Dialog, Paper, Menu): set `backgroundImage: 'none'` on Paper where needed — dark elevation can look wrong otherwise.
- Feature flag: `import.meta.env.VITE_FEATURE_DARK_THEME !== 'false'` (on by default). Changes to flag semantics must update **both** `featureFlags.js` and the Vite `transformIndexHtml` plugin in `vite.config.js`.
- Dark preview: `/dark` or `/dark/…` forces dark styling; exit via the header appearance menu. `withDarkPath(pathname, to)` in `routePaths.js` keeps internal links under `/dark/…`.

## RTL

- Logical CSS only: `margin-inline-start`, `padding-inline-end`, `border-inline-start`, etc.
- JS inline `style` objects: `marginInlineEnd`, `marginInlineStart`.
- When touching Drawer / icon placement / flex direction, verify the layout under `ar` — MUI's `direction: 'rtl'` flips most but not all.

## Print

- Global print rules: `src/index.css` (hides `header` / `nav` / `footer`, forces light paper).
- `PrintHeader` uses `filter: invert(1)` on the logo img and `color-scheme: light` on the container. Do not remove without a like-for-like replacement — the logo asset is light-on-transparent and would disappear on white paper.
- Hide interactive-only UI with `@media print { display: none }`.
- Use logical CSS properties in print rules so RTL documents print correctly.

## Portal (src/components/Portal*.jsx and src/components/portal*)

- Two-shell strategy: `App.jsx` detects portal routes via `isPortalRoute()` and renders `PortalApp`. Do not render portal pages inside the marketing shell; do not add portal-specific nav to `ResponsiveNavbar`.
- New portal pages: register route in `PortalRoutes` (App.jsx), add nav item in `PortalSidebar.jsx` with icon + i18n label + role gate, add page-title mapping in `PortalTopBar.jsx` `usePageTitle`, add i18n keys to all four locales.
- Content cards: `Paper variant="outlined"` (not raw `Box` with border).
- Page headings: `variant="h5"` or `h6` — the top bar already renders the page title as `h1`.
- Feedback: use `usePortalFeedback()` + `PortalFeedbackSnackbar` for success/error outcomes. Do not introduce new inline `Alert` or `InlineActionStatus` for actionable outcomes.
- Status chips: MUI `Chip` with semantic color (`warning` open, `info` in-progress, `success` resolved).
- Empty states: always show descriptive text, never a blank area.

## Buttons

- `type="button"` on non-submit controls inside forms or ambiguous regions. `PrintButton` and `PersonalizeCardButton` already set this via `styled.attrs`.

## After UI changes — verify

1. Light mode
2. Dark mode
3. `/dark/…` preview route for affected pages
4. Print preview
5. At least one RTL locale (`ar`) if layout/spacing changed
6. `npx vitest run`
7. `npm run build` if you changed Vite HTML injection or env handling

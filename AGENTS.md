# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Carwoods is a static React 18 website (no backend/database) for property management in Houston. Uses Vite 7, MUI v6, and npm as the package manager.

### Running the app

- `npm run dev` starts the Vite dev server on port 3000.
- `npm run build` outputs a production build to `build/`.
- **Dark theme** follows system preference and saved choice by default (feature **on**). Disable the feature with `VITE_FEATURE_DARK_THEME=false` in the environment or `.env`.
- **Dark preview:** open **`/dark`** or **`/dark/…`** to force dark styling regardless of flag; use the header appearance menu to exit preview.

### Testing

- **Unit tests**: `npx vitest run`. All run in jsdom, no server needed.
- **Lint**: `npx eslint src/` — there are 2 pre-existing `no-restricted-globals` errors in `src/styles.js` (usage of `history`). These are not regressions.
- **E2E tests**: `npm run test:e2e` requires Playwright Chromium (`npm run test:e2e:install`). Note: `playwright.config.js` uses CommonJS syntax (`require`/`module.exports`) but `package.json` has `"type": "module"`, which causes a `ReferenceError: require is not defined` when running E2E tests. This is a pre-existing issue.

### Gotchas

- The Vite dev server uses `usePolling: true` for file watching (configured for container compatibility).
- No secrets or API keys are required; the `.env` file only contains `CHOKIDAR_USEPOLLING=true`.
- The `homepage` field in `package.json` is `https://carwoods.com` for GitHub Pages deployment; this does not affect the dev server.

---

## Theming & styling (read before UI changes)

These rules reduce rework when adding features that must work in **light**, **dark**, and **print**.

### Architecture (do not bypass)

1. **`ThemeModeProvider`** (`src/ThemeModeContext.jsx`) wraps **`BrowserRouter`** in `index.jsx`. It resolves effective mode (system, `localStorage` override, or `/dark` preview) and wraps MUI **`ThemeProvider`**.
2. **`buildTheme` + `applyThemeCssVariables`** (`src/theme.js`) sync palette tokens to **`document.documentElement`** as CSS custom properties. **Styled-components** in `styles.js` consume `var(--…)`; they do not import a static dark palette.
3. **MUI components** get colors from the active MUI theme. Prefer **`useTheme()`**, **`sx`**, or theme overrides in `buildTheme` → `components` — avoid hardcoded hex in JSX for surfaces, text, borders, and controls.
4. **Semantic CSS variables** (examples): `--cta-button-*` (filled marketing CTAs), `--personalize-button-*` (wizard card button), `--nav-chrome-*` (header links), `--footer-*` / `--palette-app-chrome-*` (header/footer bar), `--menu-item-*` (dropdown rows). **Do not** use `--button-on-primary` or `--footer-on-primary` on arbitrary `primary.main` fills; those are tied to **app chrome** contrast. Use **`theme.palette.getContrastText(bg)`** or dedicated tokens when adding new “button on color X” patterns.

### When adding or changing UI

- **No light-only inline styles** in shared flows (dialogs, wizards, cards, nav): use theme + `alpha()` or CSS variables so dark mode stays consistent.
- **New `styled-components`**: prefer **`var(--palette-…)`** / **`var(--cta-button-…)`** etc. If no variable exists, **add it in `applyThemeCssVariables`** next to related tokens instead of scattering hex.
- **New MUI surfaces** (Dialog, Paper, Menu): ensure **`backgroundImage: 'none'`** on Paper where needed; dark elevation can otherwise look wrong.
- **Buttons**: `type="button"` on non-submit controls inside forms or ambiguous regions. **`PrintButton`** and **`PersonalizeCardButton`** already set this via `styled.attrs`.

### Routing & dark preview

- **`withDarkPath(pathname, to)`** (`src/routePaths.js`): use for **internal** `Link` / `NavLink` / `href` targets so users stay under **`/dark/…`** while previewing. Update when adding new top-level routes.
- **`App.jsx`** uses a **synthetic `location`** for `Routes` so paths under `/dark/*` match the same route config; keep that in sync when adding routes.

### Accessibility (WCAG-minded)

- Any **text on a colored bar** (footer, header, primary-filled chip): verify **~4.5:1** contrast for normal text; use dedicated tokens or `getContrastText`.
- **Non-color cues** for links on colored backgrounds (e.g. underline) where contrast is tight.

### Print (`@media print`)

- Global print rules live in **`src/index.css`** (hides `header`/`nav`/`footer`, forces light paper).
- **`PrintHeader`** (`styles.js`): print-only logo block. Logo asset is **light-on-transparent**; **`filter: invert(1)`** on the **print** `img` keeps it visible on **white paper** (same as historical light-mode print). **`color-scheme: light`** on the print `PrintHeader` container avoids dark-mode `color-scheme` skewing print output.
- Hide interactive-only UI with **`@media print { display: none }`** on the styled component (e.g. personalize card, print button — already done where needed).

### Feature flag & HTML boot script

- **`FEATURE_DARK_THEME`**: `import.meta.env.VITE_FEATURE_DARK_THEME !== 'false'` (on by default).
- **`vite.config.js`** `transformIndexHtml`: injects the early **dark flash** script only when the flag is not `false`. If you change flag semantics, update **both** `featureFlags.js` and the Vite plugin.

### Checklist for “theming” or “new major UI” tasks

1. Verify **light + dark** (and **`/dark/apply`** or similar) plus **print preview** for affected pages.
2. Grep for **hardcoded `#fff` / `#1976` / `#e8f0`** in the touched feature; replace with theme/vars.
3. Run **`npx vitest run`**; update tests if **appearance menu** copy or **route** behavior depends on flag + path.
4. Run **`npm run build`** if you change **Vite** HTML injection or env handling.

---

## Suggested user “base prompt” snippets (copy when opening a task)

You can paste one of these at the start of a request to align the agent with this repo:

**Theming / dark mode**

> Follow `AGENTS.md` (Theming & styling). Use MUI theme + `applyThemeCssVariables` / CSS variables; no light-only hex in dialogs or wizards. Respect `/dark` preview and `withDarkPath` for links. Verify print if the page has `PrintHeader` or print CSS.

**New page or route**

> Follow `AGENTS.md`. Add routes in `App.jsx` (and under `/dark` via the existing pattern). Prefix internal links with `withDarkPath` where appropriate. Run `npx vitest run` and `npm run build`.

**Accessibility**

> Follow `AGENTS.md` contrast rules; use `getContrastText` or dedicated footer/CTA tokens. Do not assume yellow or white text on arbitrary blues passes WCAG AA.

**Print**

> Do not remove `PrintHeader` img invert without replacing with another guaranteed dark-on-white treatment. Keep `color-scheme: light` on the print header block if the app supports dark mode.

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
- **E2E tests**: `npm run test:e2e` requires Playwright Chromium (`npm run test:e2e:install`). Use **`playwright.config.mjs`** and **`e2e/*.spec.mjs`** (ESM) so Playwright loads under `"type": "module"` in `package.json`.

### Gotchas

- The Vite dev server uses `usePolling: true` for file watching (configured for container compatibility).
- No secrets or API keys are required; the `.env` file only contains `CHOKIDAR_USEPOLLING=true`.
- The `homepage` field in `package.json` is `https://carwoods.com` for GitHub Pages deployment; this does not affect the dev server.
- **HAR listing fetch**: `scripts/fetchHarRentalApplyTiles.mjs` is run as `prebuild`. HAR.com may return 403 in restricted environments (e.g. Vercel CI). The script gracefully falls back to the committed `src/data/rentalPropertyApplyTiles.generated.js` when a network error occurs and the file already exists. **Never delete the generated file from the repo.** To update listings locally, run `npm run update-rental-tiles`.

---

## Theming & styling (read before UI changes)

These rules reduce rework when adding features that must work in **light**, **dark**, and **print**.

### Architecture (do not bypass)

1. **`ThemeModeProvider`** (`src/ThemeModeContext.jsx`) is wrapped by **`LanguageProvider`** in `index.jsx`. It reads `isRTL` directly from `useLanguage()` and uses the RTL Emotion cache when Arabic is active. It resolves effective mode (system, `localStorage` override, or `/dark` preview) and wraps MUI **`ThemeProvider`**.
2. **`buildTheme` + `applyThemeCssVariables`** (`src/theme.js`) sync palette tokens to **`document.documentElement`** as CSS custom properties. **Styled-components** in `styles.js` consume `var(--…)`; they do not import a static dark palette. `buildTheme(mode, isRTL)` sets MUI `direction` for RTL mirroring.
3. **MUI components** get colors from the active MUI theme. Prefer **`useTheme()`**, **`sx`**, or theme overrides in `buildTheme` → `components` — avoid hardcoded hex in JSX for surfaces, text, borders, and controls.
4. **Semantic CSS variables** (examples): `--cta-button-*` (filled marketing CTAs), `--personalize-button-*` (wizard card button), `--nav-chrome-*` (header links), `--footer-*` / `--palette-app-chrome-*` (header/footer bar), `--menu-item-*` (dropdown rows). **Do not** use `--button-on-primary` or `--footer-on-primary` on arbitrary `primary.main` fills; those are tied to **app chrome** contrast. Use **`theme.palette.getContrastText(bg)`** or dedicated tokens when adding new "button on color X" patterns.

### When adding or changing UI

- **No light-only inline styles** in shared flows (dialogs, wizards, cards, nav): use theme + `alpha()` or CSS variables so dark mode stays consistent.
- **New `styled-components`**: prefer **`var(--palette-…)`** / **`var(--cta-button-…)`** etc. If no variable exists, **add it in `applyThemeCssVariables`** next to related tokens instead of scattering hex.
- **New MUI surfaces** (Dialog, Paper, Menu): ensure **`backgroundImage: 'none'`** on Paper where needed; dark elevation can otherwise look wrong.
- **Buttons**: `type="button"` on non-submit controls inside forms or ambiguous regions. **`PrintButton`** and **`PersonalizeCardButton`** already set this via `styled.attrs`.
- **Physical CSS directions** (`margin-left`, `padding-right`, etc.): replace with **logical properties** (`margin-inline-start`, `padding-inline-end`) so RTL layout mirrors automatically without extra overrides.

### Routing & dark preview

- **`withDarkPath(pathname, to)`** (`src/routePaths.js`): use for **internal** `Link` / `NavLink` / `href` targets so users stay under **`/dark/…`** while previewing. Update when adding new top-level routes.
- **`App.jsx`** uses a **synthetic `location`** for `Routes` so paths under `/dark/*` match the same route config; keep that in sync when adding routes.

### Accessibility (WCAG-minded)

- Any **text on a colored bar** (footer, header, primary-filled chip): verify **~4.5:1** contrast for normal text; use dedicated tokens or `getContrastText`.
- **Non-color cues** for links on colored backgrounds (e.g. underline) where contrast is tight.
- **Language-switching controls**: icon buttons must have `aria-label`, `aria-haspopup`, `aria-expanded`, and `aria-controls`. Each language menu item should carry a `lang` attribute matching its language code so screen readers announce it correctly.

### Print (`@media print`)

- Global print rules live in **`src/index.css`** (hides `header`/`nav`/`footer`, forces light paper).
- **`PrintHeader`** (`styles.js`): print-only logo block. Logo asset is **light-on-transparent**; **`filter: invert(1)`** on the **print** `img` keeps it visible on **white paper** (same as historical light-mode print). **`color-scheme: light`** on the print `PrintHeader` container avoids dark-mode `color-scheme` skewing print output.
- Hide interactive-only UI with **`@media print { display: none }`** on the styled component (e.g. personalize card, filter banner, print button, wizard dialogs — already done where needed).
- Use **logical CSS properties** (`padding-inline-start` not `padding-left`) in print rules so RTL documents print correctly.
- Any empty sentinel elements (e.g. `<span id="page-top" />`) must **not** inadvertently render as visible dots or bullets in print; hide them explicitly if needed.

### Feature flag & HTML boot script

- **`FEATURE_DARK_THEME`**: `import.meta.env.VITE_FEATURE_DARK_THEME !== 'false'` (on by default).
- **`vite.config.js`** `transformIndexHtml`: injects the early **dark flash** script only when the flag is not `false`. If you change flag semantics, update **both** `featureFlags.js` and the Vite plugin.

### Checklist for "theming" or "new major UI" tasks

1. Verify **light + dark** (and **`/dark/apply`** or similar) plus **print preview** for affected pages.
2. Grep for **hardcoded `#fff` / `#1976` / `#e8f0`** in the touched feature; replace with theme/vars.
3. Run **`npx vitest run`**; update tests if **appearance menu** copy or **route** behavior depends on flag + path.
4. Run **`npm run build`** if you change **Vite** HTML injection or env handling.

---

## Internationalisation / multi-language (read before any text or UI changes)

The site supports **English, Spanish, French, and Arabic** via `i18next` + `react-i18next`. Arabic is RTL.

### Architecture (do not bypass)

1. **`src/i18n.js`** initialises i18next with all four locale bundles. It is imported in `src/setupTests.js` (tests) and `src/index.jsx` (runtime) — both must keep that import.
2. **`src/locales/{en,es,fr,ar}/translation.json`** — all user-visible strings live here, namespaced by feature (e.g. `nav.*`, `home.*`, `tenantCriteria.*`). **Never hard-code English text in JSX** for anything the user will read.
3. **`src/LanguageContext.jsx`** — provides `currentLanguage`, `direction`, `isRTL`, `changeLanguage()`. It sets `<html dir>` and `<html lang>` on every language switch and persists the choice via `src/languagePreferenceStorage.js`.
4. **`src/ThemeModeContext.jsx`** consumes `useLanguage()` internally (not via prop). This keeps the dark-mode `storedOverride` stable across language switches. **Do not** pass `isRTL` as a prop from outside — let `ThemeModeProvider` read it directly from `LanguageContext`.
5. **Provider order in `index.jsx`**: `LanguageProvider` wraps `ThemeModeProvider` wraps the app. Reversing this order breaks the RTL cache.
6. **RTL CSS**: MUI direction + `stylis-plugin-rtl` (via `@emotion/cache`) automatically mirror MUI and Emotion-generated styles. For styled-components and plain CSS, use **logical properties** (`margin-inline-start`, `padding-inline-end`, `border-inline-start`, etc.) — physical properties like `margin-left` will NOT flip.

### Adding or updating translations

- Add keys to **all four locale files** simultaneously. Leaving a key absent in any locale causes i18next to fall back to English silently — which is acceptable, but deliberate omissions should be noted.
- Use `useTranslation()` hook: `const { t } = useTranslation();` then `t('namespace.key')`.
- For split sentences with an inline link (e.g. "See our **Apply** page"), break the string into `prefix`, `linkText`, and `suffix` keys rather than embedding HTML in the JSON. See `contact.para1Prefix` / `contact.applyLinkText` / `contact.para1Suffix` as the established pattern.
- **Do not translate proper nouns** that must stay in English regardless of language: HAR.com, RentSpree, RFTA, W-2, 1099, SSN, VA, SSDI, SSA/SSI, Section 8, TCDRS, TRS, FERS, dog breed names.
- **`buildChipLabel`** in `ApplicantWizard.jsx` and the wizard `QUESTIONS` array contain hard-coded English strings — translate these via `useTranslation` when modifying the wizard.

### RTL layout rules

- Use **`marginInlineEnd` / `marginInlineStart`** (JS object form) in inline `style` props, not `marginRight` / `marginLeft`.
- In styled-components, use `margin-inline-end` CSS, not `margin-right`.
- MUI `direction: 'rtl'` (set by `buildTheme`) flips most MUI spacing automatically; verify Drawer anchor, icon placement, and flex row direction still look correct.
- The `<html dir="rtl">` attribute is set by `LanguageContext`; CSS `[dir="rtl"]` selectors in `index.css` handle any overrides that MUI cannot reach.
- Arabic uses a separate font stack (`'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial`) applied via `[dir="rtl"] body` in `index.css` — do not override the font-family inline for Arabic text.

### Test requirements for i18n changes

- **Reset i18n language between tests**: call `await i18n.changeLanguage('en')` in `beforeEach` for any test file that switches languages. Failure to reset causes cross-test language bleed.
- Import `i18n` from `src/i18n.js` (not `'i18next'`) for the reset — this ensures the same instance used by the app.
- `src/setupTests.js` already imports `./i18n` to initialise it globally; do not remove that import.
- Wrap components that use `useLanguage()` (e.g. `ResponsiveNavbar`, `ThemeModeProvider`) with `<LanguageProvider>` in tests; components that only use `useTranslation()` do not need it.
- The `WithAppTheme` helper (`src/testUtils.jsx`) already provides `LanguageProvider` — prefer it over ad-hoc provider stacks.

---

## Suggested user "base prompt" snippets (copy when opening a task)

You can paste one of these at the start of a request to align the agent with this repo:

**Theming / dark mode**

> Follow `AGENTS.md` (Theming & styling). Use MUI theme + `applyThemeCssVariables` / CSS variables; no light-only hex in dialogs or wizards. Respect `/dark` preview and `withDarkPath` for links. Verify print if the page has `PrintHeader` or print CSS.

**New page or route**

> Follow `AGENTS.md`. Add routes in `App.jsx` (and under `/dark` via the existing pattern). Prefix internal links with `withDarkPath` where appropriate. Run `npx vitest run` and `npm run build`.

**Accessibility**

> Follow `AGENTS.md` contrast rules; use `getContrastText` or dedicated footer/CTA tokens. Do not assume yellow or white text on arbitrary blues passes WCAG AA.

**Print**

> Do not remove `PrintHeader` img invert without replacing with another guaranteed dark-on-white treatment. Keep `color-scheme: light` on the print header block if the app supports dark mode. Use logical CSS properties in print rules for RTL compatibility. Hide any interactive-only UI (wizard, filter banner, dialogs) with `@media print { display: none }`.

**Multi-language / i18n**

> Follow `AGENTS.md` (Internationalisation). Add all strings to all four locale files (`en`, `es`, `fr`, `ar`). Use `useTranslation()` — never hard-code English in JSX. Use logical CSS properties (not `margin-left`) so RTL mirrors automatically. `ThemeModeProvider` reads `isRTL` from `LanguageContext` internally — do not pass it as a prop. Reset `i18n.changeLanguage('en')` in test `beforeEach` to prevent language bleed. Run `npx vitest run` and `npm run build` when done.

**Wizard / filter (ApplicantWizard)**

> The `ApplicantWizard` and its `QUESTIONS` / `buildChipLabel` contain user-visible strings — translate all of them via `useTranslation()` following the established pattern in the locale files. The wizard dialog, filter banner, and personalize card are already hidden in print; keep those `@media print { display: none }` rules intact.

**Build / deployment**

> The `prebuild` script fetches HAR listings and may receive a 403 in CI. It falls back to the committed `src/data/rentalPropertyApplyTiles.generated.js` when the file exists — never delete that file. To refresh listings, run `npm run update-rental-tiles` locally and commit the result.

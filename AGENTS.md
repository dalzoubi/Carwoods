# AGENTS.md

## Overview

Carwoods is a static React 18 website (no backend/database) for property management in Houston. Uses Vite 7, MUI v6, styled-components, i18next (en/es/fr/ar), and npm as the package manager. No TypeScript.

**Tenant portal (in progress):** Azure backend, PostgreSQL, and shared packages live under `apps/api`, `packages/*`, `infra/`, and `docs/portal/`. See [docs/portal/MONOREPO.md](docs/portal/MONOREPO.md) and [docs/portal/IMPLEMENTATION_PROMPT.md](docs/portal/IMPLEMENTATION_PROMPT.md). Azure resources MUST use resource group **`carwoods.com`**.

## Commands

| Task | Command |
|---|---|
| Dev server (port 3000) | `npm run dev` |
| Production build → `build/` | `npm run build` |
| Unit tests (jsdom, no server) | `npx vitest run` |
| Lint | `npx eslint src/` |
| E2E tests (Playwright) | `npm run test:e2e` |
| Install E2E browser | `npm run test:e2e:install` |
| Refresh HAR listings | `npm run update-rental-tiles` |

## Project structure

```
src/
├── index.jsx              # App entry — LanguageProvider → ThemeModeProvider → App
├── App.jsx                # Routes (incl. /dark/* synthetic location)
├── theme.js               # buildTheme() + applyThemeCssVariables()
├── styles.js              # Styled-components consuming CSS variables
├── index.css              # Global CSS, print rules, RTL overrides
├── i18n.js                # i18next init with all four locale bundles
├── ThemeModeContext.jsx    # Dark mode provider (reads isRTL internally)
├── LanguageContext.jsx     # Language/RTL provider, sets <html dir> and <html lang>
├── routePaths.js           # withDarkPath() for /dark/* link prefixing
├── featureFlags.js         # VITE_FEATURE_DARK_THEME flag
├── testUtils.jsx           # WithAppTheme test helper
├── locales/{en,es,fr,ar}/translation.json
├── data/
│   ├── harRentalListingIds.js
│   └── rentalPropertyApplyTiles.generated.js  ← DO NOT DELETE
├── components/
│   ├── Home.jsx, Apply.jsx, ContactUs.jsx, Privacy.jsx, Accessibility.jsx
│   ├── ResponsiveNavbar.jsx, Footer.jsx, ApplyFlowSubnav.jsx
│   ├── ApplicantWizard.jsx, TenantSelectionCriteria.jsx
│   ├── RentalPropertyApplyTiles.jsx, PropertyManagement.jsx
│   ├── ApplicationRequiredDocuments.jsx, TocPageLayout.jsx
│   └── *.test.jsx (co-located unit tests)
scripts/
├── fetchHarRentalApplyTiles.mjs   # prebuild — falls back to committed file on 403
└── generatePublicIcons.mjs
e2e/
└── critical-path.spec.mjs         # Playwright E2E (ESM)
```

## Dos and don'ts

**Always:**
- Use `useTranslation()` for all user-visible strings — add keys to all four locale files
- Use MUI theme / CSS variables for colors — new variables go in `applyThemeCssVariables`
- Use logical CSS properties (`margin-inline-start` not `margin-left`) for RTL
- Set `type="button"` on non-submit buttons inside forms
- Test in light + dark + `/dark/…` preview + print when touching UI

**Never:**
- Hard-code English text in JSX
- Hard-code hex colors in components
- Delete `src/data/rentalPropertyApplyTiles.generated.js`
- Pass `isRTL` as a prop to `ThemeModeProvider` (it reads from `LanguageContext` internally)
- Reverse provider order: `LanguageProvider` must wrap `ThemeModeProvider`
- Use physical CSS directions (`margin-left`) in styled-components or print rules

**Ask first:**
- Adding new dependencies
- Route or path changes
- Form field/payload changes
- SEO metadata or heading hierarchy changes
- Design token or shared hook behavior changes

## Dark theme

- Feature **on** by default. Disable with `VITE_FEATURE_DARK_THEME=false` in `.env`.
- **Dark preview:** open `/dark` or `/dark/…` to force dark styling; exit via header appearance menu.
- `vite.config.js` `transformIndexHtml` injects an early flash-prevention script when the flag is not `false`. Changes to flag semantics must update both `featureFlags.js` and the Vite plugin.

## Gotchas

- Vite dev server uses `usePolling: true` (container compatibility).
- No secrets or API keys; `.env` only contains `CHOKIDAR_USEPOLLING=true`.
- `homepage` in `package.json` is `https://carwoods.com` (GitHub Pages); does not affect dev server.
- **HAR listing fetch**: `scripts/fetchHarRentalApplyTiles.mjs` runs as `prebuild`. May get 403 in CI. Falls back to committed generated file. **Never delete the generated file.**
- **Apply page API (optional):** If `VITE_API_BASE_URL` is set and `VITE_FEATURE_APPLY_API` is not `false`, `/apply` loads tiles from `GET {base}/api/public/apply-properties` first, then falls back to the generated file. In dev, API vs generated differences log to the console unless `VITE_FEATURE_APPLY_DUAL_SOURCE=false`.
- 2 pre-existing `no-restricted-globals` lint errors in `src/styles.js` (`history`) — not regressions.
- E2E files must be ESM (`.mjs`) because `package.json` has `"type": "module"`.

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
- **Do not translate proper nouns** that must stay in English regardless of language: HAR.com, RFTA, W-2, 1099, SSN, VA, SSDI, SSA/SSI, Section 8, TCDRS, TRS, FERS, dog breed names.
- **`buildChipLabel`** in `ApplicantWizard.jsx` and the wizard `QUESTIONS` array contain hard-coded English strings — translate these via `useTranslation` when modifying the wizard.

### RTL layout rules

- Use **`marginInlineEnd` / `marginInlineStart`** (JS object form) in inline `style` props, not `marginRight` / `marginLeft`.
- In styled-components, use `margin-inline-end` CSS, not `margin-right`.
- MUI `direction: 'rtl'` (set by `buildTheme`) flips most MUI spacing automatically; verify Drawer anchor, icon placement, and flex row direction still look correct.
- The `<html dir="rtl">` attribute is set by `LanguageContext`; CSS `[dir="rtl"]` selectors in `index.css` handle any overrides that MUI cannot reach.
- Arabic uses a separate font stack (`'Segoe UI', Tahoma, 'Noto Sans Arabic', Arial`) applied via `[dir="rtl"] body` in `index.css` — do not override the font-family inline for Arabic text.

---

## Portal UX standards (read before any portal UI changes)

The tenant portal (`/portal/*`) has its own dedicated layout separate from the marketing site. These rules ensure consistency.

### Architecture (do not bypass)

1. **Two-shell strategy**: `App.jsx` detects portal routes via `isPortalRoute()` and renders `PortalApp` (sidebar + top bar) instead of the marketing shell (`ResponsiveNavbar` + `Footer`). **Do not** render portal pages inside the marketing shell.
2. **`PortalLayout`** (`src/components/PortalLayout.jsx`): flex container with `PortalSidebar` (permanent on `md+`, temporary drawer on mobile) and a main content area with `PortalTopBar`.
3. **`PortalAuthGate`** (`src/components/PortalAuthGate.jsx`): wraps the layout; shows `PortalLoginLanding` for unauthenticated users, a spinner during MSAL initialization, and the layout + routes when authenticated.
4. **`PortalSidebar`** (`src/components/PortalSidebar.jsx`): logo, role-gated nav links, user footer with avatar + role chip + sign out. Width is `SIDEBAR_WIDTH` (260 px).
5. **`PortalTopBar`** (`src/components/PortalTopBar.jsx`): compact sticky AppBar with page title, hamburger on mobile, user avatar + role chip.

### When adding portal pages

- Register the route in the `PortalRoutes` component in `App.jsx`.
- Add a nav item in `PortalSidebar.jsx` with an MUI icon, i18n label, and role gating.
- Add page-title mapping in `PortalTopBar.jsx` `usePageTitle`.
- Add i18n keys to **all four** locale files.
- Use `Paper variant="outlined"` for content cards, not raw `Box` with border.
- Use `variant="h5"` or `variant="h6"` for page headings (the top bar already shows the page title as `h1`).

### Portal component patterns

- **Dashboard** (`PortalDashboard`): welcome card, stat cards with `StatCard`, quick action buttons, recent-items list.
- **List + detail** (`PortalRequests`): responsive split pane — side-by-side on `md+`, stacked on mobile. Use `Paper variant="outlined"` for each pane.
- **Forms** (`PortalProfile`, `PortalAdminLandlords`): `Paper variant="outlined"` card, `Snackbar` for success feedback, inline `Alert` for errors.
- **Login landing** (`PortalLoginLanding`): centered `Paper` card with logo, value proposition, social sign-in buttons, and generic sign-in fallback.
- **Status chips**: use MUI `Chip` with semantic `color` (`warning` for open, `info` for in-progress, `success` for resolved).
- **Empty states**: always show descriptive text, never a blank area.

### Do not

- Hard-code hex colors in portal components — use MUI theme tokens.
- Use the marketing `Container`, `Content`, `AppShell`, or `Footer` inside portal routes.
- Add portal-specific nav items to `ResponsiveNavbar` — the marketing navbar only has a single "Portal" link.
- Render `PortalSignOutConfirmDialog` outside `PortalSidebar` or the marketing navbar account menu.

### Test requirements for portal components

- Wrap portal components in `PortalAuthProvider` and `LanguageProvider` (or use `WithAppTheme`).
- Mock `usePortalAuth` for unauthenticated / authenticated / admin scenarios.
- Verify both mobile and desktop breakpoints for layout components.

---

### Test requirements for i18n changes

- **Reset i18n language between tests**: call `await i18n.changeLanguage('en')` in `beforeEach` for any test file that switches languages. Failure to reset causes cross-test language bleed.
- Import `i18n` from `src/i18n.js` (not `'i18next'`) for the reset — this ensures the same instance used by the app.
- `src/setupTests.js` already imports `./i18n` to initialise it globally; do not remove that import.
- Wrap components that use `useLanguage()` (e.g. `ResponsiveNavbar`, `ThemeModeProvider`) with `<LanguageProvider>` in tests; components that only use `useTranslation()` do not need it.
- The `WithAppTheme` helper (`src/testUtils.jsx`) already provides `LanguageProvider` — prefer it over ad-hoc provider stacks.


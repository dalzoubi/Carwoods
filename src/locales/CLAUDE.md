# Translations — Claude scope

Applies to `src/locales/**`, `src/i18n.js`, `src/LanguageContext.jsx`, and `src/languagePreferenceStorage.js`. Read the "Internationalisation" section of `AGENTS.md` before structural changes.

## Add keys to all four locales simultaneously

Every new key must land in `en`, `es`, `fr`, and `ar` in the same change. A missing key falls back to English silently — acceptable as a stopgap but never the intended state.

- Use `useTranslation()` — never hard-code English in JSX
- Keep namespacing by feature area (`nav.*`, `home.*`, `tenantCriteria.*`)
- For Spanish/French, translate meaning not words. For Arabic, verify the text reads naturally RTL

## Split-link pattern for sentences with inline links

Do not embed HTML in translation JSON. Use three keys:

```jsx
<Trans i18nKey="contact.para1">
  {t('contact.para1Prefix')}
  <Link to="/apply">{t('contact.applyLinkText')}</Link>
  {t('contact.para1Suffix')}
</Trans>
```

See `contact.para1Prefix` / `contact.applyLinkText` / `contact.para1Suffix` for the reference implementation.

## Do not translate proper nouns

Keep in English across all four locales:

- HAR.com, RFTA, W-2, 1099, SSN
- VA, SSDI, SSA/SSI, Section 8
- TCDRS, TRS, FERS
- Dog breed names

## RTL layout rules

- JS inline `style`: `marginInlineEnd` / `marginInlineStart`, not `marginRight` / `marginLeft`
- Styled-components: `margin-inline-end`, not `margin-right`
- MUI `direction: 'rtl'` flips most spacing — verify Drawer anchor, icon placement, flex direction
- Arabic font stack is set via `[dir="rtl"] body` in `index.css` — do not override inline

## Provider order (do not reverse)

In `index.jsx`: `LanguageProvider` → `ThemeModeProvider` → app. `ThemeModeProvider` reads `isRTL` via `useLanguage()` internally — do not pass it as a prop.

## Hard-coded strings that need migration

`buildChipLabel` in `ApplicantWizard.jsx` and the wizard `QUESTIONS` array contain hard-coded English. When modifying the wizard, migrate those to `useTranslation`.

## Testing

- Reset language in `beforeEach`: `await i18n.changeLanguage('en')` — import `i18n` from `src/i18n.js`, not `'i18next'`
- `src/setupTests.js` imports `./i18n` globally — do not remove that import
- Components using `useLanguage()` need `<LanguageProvider>` in tests. Components using only `useTranslation()` do not.
- Prefer `WithAppTheme` from `src/testUtils.jsx` over ad-hoc provider stacks.

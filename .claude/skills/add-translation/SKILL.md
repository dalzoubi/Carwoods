---
name: add-translation
description: Add a new i18n key to all four locale files (en, es, fr, ar) consistently, with attention to split-link patterns, proper-noun preservation, and RTL. Use when the user asks to add a translation, translate a string, or when adding user-visible copy to a component.
---

# Add Translation

## Purpose

Guarantee every new translation key lands in **all four** locales with the right value, using the repo's established patterns — so nothing silently falls back to English and RTL layout is considered up front.

## Inputs to read first

1. `AGENTS.md` → "Internationalisation / multi-language" section
2. `src/locales/CLAUDE.md`
3. The four locale files:
   - `src/locales/en/translation.json`
   - `src/locales/es/translation.json`
   - `src/locales/fr/translation.json`
   - `src/locales/ar/translation.json`
4. The consuming component (to confirm it uses `useTranslation()` and not `useLanguage()` unless it needs direction)

## Workflow

1. **Locate the right namespace**. Keys are grouped by feature (`nav.*`, `home.*`, `tenantCriteria.*`, `portal.*`, etc.). Reuse an existing namespace unless the feature is new.
2. **Pick a key name** that describes the role of the copy, not the copy itself. Bad: `button.clickHere`. Good: `portal.support.submitTicket`.
3. **Check proper-noun list** before translating:
   - Do **not** translate: HAR.com, RFTA, W-2, 1099, SSN, VA, SSDI, SSA/SSI, Section 8, TCDRS, TRS, FERS, dog breed names
   - Keep these in English across all four files
4. **Split sentences with inline links** into `prefix` / `linkText` / `suffix` keys. Reference: `contact.para1Prefix`, `contact.applyLinkText`, `contact.para1Suffix`. Do not embed HTML in JSON.
5. **Add the key to all four locale files in the same edit**:
   - `en`: source copy
   - `es`, `fr`: translated meaning, not word-for-word
   - `ar`: translated and phrased to read naturally RTL
6. **Verify JSON validity** — each file must still parse. Watch trailing commas and key ordering.
7. **Update the component** to use `t('namespace.key')` via `useTranslation()`.
8. **If the string appears in a wizard/chip** (e.g. `buildChipLabel` in `ApplicantWizard.jsx` or `QUESTIONS` array): migrate the hard-coded English at the same time rather than leaving mixed states.
9. **Tests**: reset language in `beforeEach` with `await i18n.changeLanguage('en')` if the test switches languages. Import `i18n` from `src/i18n.js`.

## RTL considerations

When adding copy that drives layout (buttons with icons, breadcrumbs, badges):

- Prefer logical CSS (`margin-inline-start`, `padding-inline-end`) in any new styled-components or inline `style` objects (`marginInlineStart`)
- Arabic uses a separate font stack applied via `[dir="rtl"] body` in `index.css` — do not override `font-family` inline

## Output format

Report to the user:

```markdown
## Keys added

- `namespace.key` — used in `<file>:<line>`

## Locale coverage

- [x] en — "..."
- [x] es — "..."
- [x] fr — "..."
- [x] ar — "..."

## Follow-ups
- (Any hard-coded siblings that should be migrated in a follow-up PR)
- (Any tests that need a language reset)
```

## Guardrails

- Never leave a key out of one locale. If you genuinely don't have a translation yet, flag it and ask — do not ship with `""` silently falling back
- Never embed `<a>` / `<strong>` tags in JSON values; use Trans-style composition
- Never translate proper nouns on the fixed list above

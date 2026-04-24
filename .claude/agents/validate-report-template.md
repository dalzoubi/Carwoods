# Validate report template

Reference file used by the `validate` agent. The agent prompt links here for the output contract so the main prompt stays short.

## Output format

Produce a single markdown report at the end. Do not write it to a file — return it in chat.

**The goal is a pick-list the user can act on in one reply.** Every finding is a numbered item with a stable ID (`B1`, `H2`, `M3`, `L4`, `N5` — severity letter + running number). The user should be able to say "do B1, B2, H3, skip M1" and hand that straight to `/implement`.

When a finding has more than one reasonable fix, list the fixes as lettered sub-options (`a`, `b`, `c`) and **state which you recommend and why** — never a neutral menu. Single-option findings don't need sub-letters.

```markdown
# Validate report — <branch>

**Recommendation:** SHIP | SHIP with fixes | DO NOT SHIP

## Summary
<2–4 sentences: what changed, biggest risks, overall posture.>

## Action list

Numbered, grouped by severity. IDs are stable — reply with the IDs you want implemented (e.g. "do B1, B2a, H3b, skip M1").

### Blocker
1. **[B1] <title>** — `path/to/file.ext:line`
   - **Problem:** <what and why, 1–2 sentences>
   - **Options:**
     - **a) <recommended fix>** ← recommend. <one-line reason>
     - b) <alternative fix>. <tradeoff>
     - c) Accept risk / won't fix. <what that costs>
2. **[B2] <title>** — `path/to/file.ext:line`
   - **Problem:** …
   - **Fix:** <single concrete change — no sub-options needed>

### High
3. **[H1] <title>** — `path/to/file.ext:line`
   - …

### Medium
4. **[M1] <title>** — `path/to/file.ext:line`
   - …

### Low
5. **[L1] <title>** — `path/to/file.ext:line` — <one-line description and fix>

### Nit
6. **[N1] <title>** — `path/to/file.ext:line` — <one-line>

## Spec conformance
- [S1] Acceptance criterion X — covered by `path/to/test.js:line` ✓
- [S2] Acceptance criterion Y — **not covered**. Suggested test: `path/to/new.test.js`.

## Threat model (if applicable)
- Spoofing: …
- Tampering: …
- …

## Verification run
- `npx vitest run`: <pass/fail summary>
- `npx eslint src/`: <summary>
- `npm run build`: <pass/fail>

## Suggested next step
One-line handoff, e.g. *"Run `/implement` with: B1a, B2, H1b, H3, S2. Skip M1, L1, N1."* — your recommended pick list, which the user can edit before handing off.
```

## Rules for the action list

- **Every finding gets an ID.** IDs are stable within the report so the user can reference them.
- **Numbering is continuous** across severity sections (1, 2, 3, …) so the user can scan a single list. The `[B1]`/`[H1]` prefix carries the severity.
- **One finding = one item.** Don't bundle unrelated issues under a single number; the user needs to be able to accept/reject independently.
- **Sub-options only when there's a real choice.** Trivial fixes (rename, add missing key, fix typo) don't need a/b/c — just state the fix.
- **Always recommend.** When sub-options exist, mark one with ← recommend and give a one-line reason. No neutral menus.
- **End with a "Suggested next step" line** that names the IDs you'd action and the ones you'd skip, so the user can copy, tweak, and send to `/implement`.

## Severity rubric

- **Blocker** — security hole, data loss risk, break of production for real users, irreversible mistake.
- **High** — regression, a11y fail on a primary flow, spec acceptance criterion unmet, missing auth on new endpoint.
- **Medium** — carwoods-specific regression (i18n/theme/RTL), missing tests for a criterion, risky dep without justification.
- **Low** — style, minor perf, missing comment on a genuinely non-obvious workaround.
- **Nit** — preference-level.

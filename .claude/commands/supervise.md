# `/supervise` — autonomous TDD orchestrator

Drive the existing `test` → `implement` → `validate` loop across the **Implementation slices** of an approved spec, one slice at a time, with strict per-slice budgets, recurrence detection, and a Quality Bar contract injected into every child-agent prompt.

This file is the entire implementation surface for `/supervise`. There is no separate `supervise` subagent. The main agent reads this playbook and drives the existing `.claude/agents/test.md`, `implement.md`, and `validate.md` subagents via the Agent tool.

## Agent graph

One level of nesting only. Subagents do not invoke other subagents.

```
user
 └─ /supervise (main agent, this playbook)
     ├─ Agent: test        (per slice, per cycle)
     ├─ Agent: implement   (per slice, per cycle)
     └─ Agent: validate    (per slice, per cycle)
```

## Invocation & arguments

```
/supervise <spec-path> [--verbose]
```

- `<spec-path>` — required. Must resolve to a file under `docs/specs/` or `docs/portal/specs/`.
- `--verbose` — optional. Streams child-agent narration inline; default mode prints only status cards and single-line progress markers.

### Refusal and recovery rules

| Condition | Behavior |
|---|---|
| No `<spec-path>` argument | Refuse with one-line help: `Usage: /supervise <spec-path> [--verbose]`. |
| Path does not resolve | Refuse with the missing path, no guesswork. |
| Spec exists but lacks an **Implementation slices** section | Offer: *"This spec has no Implementation slices section. Invoke `/define` in-place to add one?"* On yes, drive `/define` to append the section, get user approval, then proceed. On no, exit. |
| Spec status is `Shipped` | Refuse; ask user to confirm intent and override by updating status. |
| Uncommitted changes present at start | Warn with `git status`, ask to proceed / stash / abort. |

## Preconditions

Before any work:

1. Confirm `.claude/state/` is present in `.gitignore`. If not, refuse and tell the user to add it (this playbook depends on the scratch JSON staying out of the repo).
2. Read the spec at `<spec-path>`.
3. If the spec's `Status:` is `Shipped`, refuse per the refusal table.
4. Run `git status`. If the working tree is dirty, warn and ask the user to proceed / stash / abort before starting.

## Parsing the spec

1. Locate the `## Implementation slices` heading.
2. Parse each numbered slice into: `name`, `scope`, `success criteria`, `dependencies`, optional `cycle budget` (default 3).
3. If the section is missing or empty, follow the refusal-table flow (offer `/define` in-place; on decline, exit).
4. If more than 6 slices are present, warn the user and ask whether to proceed or split the spec — context-window risk.

## State management

### TodoWrite

- One todo per slice, in spec order.
- `content`: imperative form (e.g. *"Implement profile-form-scaffold slice"*).
- `activeForm`: present continuous (e.g. *"Implementing profile-form-scaffold slice"*).
- Exactly **one** todo `in_progress` at a time. Mark complete only when the slice converges and the scoped eslint tripwire passes.

### Scratch JSON (durable, session-scoped, gitignored)

Path: `.claude/state/supervise-<slug>.json` where `<slug>` is the spec filename without extension.

Written between slices and on every pause. Schema:

```json
{
  "specPath": "docs/specs/tenant-profile-edit.md",
  "slug": "tenant-profile-edit",
  "startedAt": "2026-04-24T14:12:03Z",
  "verbose": false,
  "slices": [
    {
      "name": "profile-form-scaffold",
      "status": "completed",
      "cyclesUsed": 1,
      "filesTouched": ["src/pages/portal/Profile.jsx", "src/locales/en/portal.json", "..."],
      "findingsResolved": [],
      "findingsDeferred": [
        { "id": "VAL-NIT-012", "severity": "Nit", "summary": "..." }
      ]
    }
  ],
  "pausedSlicesInARow": 0,
  "lastCard": "…markdown of last status card…"
}
```

### In-context findings ledger

Maintain a running list of resolved and deferred findings inside the conversation, but **trim after every slice converges** — keep only IDs and one-line summaries; the durable JSON holds the full ledger. This protects the main agent's context window across long features.

## Quality Bar contract

The supervisor **prepends this exact block** to every `test`, `implement`, and `validate` Agent invocation, immediately followed by the slice scope and any cycle-specific instructions. Each child agent must begin its response by citing which items below apply to the current slice and how it will honor them. If a child agent cannot honor an applicable item, it must challenge the slice scope rather than proceed silently.

```
## Quality Bar (non-negotiable)

Before starting, state which items below apply to this slice and how you will honor them. Challenge the slice scope if any item cannot be met.

COMPONENT REUSE & UI CONSISTENCY
- Search src/components and src/pages for an existing component before creating one.
- Reuse MUI primitives + theme tokens, PrintHeader, withDarkPath, applyThemeCssVariables, packages/*.
- Match established patterns (spacing, radius, focus rings, empty/loading/error states). New patterns need explicit approval in the spec.

LOCALIZATION
- Every user-visible string (aria-labels, placeholders, validation, toasts, print labels, <title>, meta) goes through useTranslation().
- Add keys to all four locales simultaneously: en, es, fr, ar. A key in only one locale is a bug.
- Proper nouns (HAR.com, Section 8) are not translated.
- Use the split-link pattern (prefix / linkText / suffix) for sentences with inline links.
- RTL: logical CSS only (margin-inline-start, padding-inline-end, inset-inline-start).
- No manually formatted dates/numbers/currencies — use Intl.

ACCESSIBILITY (WCAG 2.1 AA)
- Semantic HTML first; headings in order; landmarks present.
- Every input labeled; icon-only buttons have aria-label; meaningful alt or alt="".
- Keyboard reachable; visible focus ring; Escape closes dialogs.
- Contrast ~4.5:1 normal / 3:1 large, verified in light and dark.
- Respect prefers-reduced-motion. Live regions for async status.

PRIVACY
- Data minimization. No PII in logs, error messages, analytics, URLs, or client-side storage unless spec authorizes it.
- Consent required for new tracking/analytics/third-party embeds.
- No secrets in client code. Portal secrets via Azure App Settings.
- Every new apps/api route has an auth guard and ownership check on record-scoped queries.
- Document retention/deletion for new user-linked data. Audit print/CSV/PDF exports for PII.

ERROR HANDLING & LOGGING
- Never surface raw errors to users. Generic, translated, actionable message via useTranslation(), keys in all four locales.
- Reuse existing toast/inline/empty-state error surfaces. Preserve user input on destructive-action failure.
- Correlation IDs only; never raw error bodies. role="alert" for blocking, polite live region otherwise. aria-describedby for field errors.
- Server-side: log real error with context (request ID, route, user ID, operation) via existing logger, never PII/secrets. Right log level. API responses return stable {code, message, correlationId?} — never stack traces or DB strings.
- Don't swallow errors silently.
```

## Loop semantics

### Per-slice budget

- Max **3** implement→validate cycles. Each cycle = one `implement` call followed by one `validate` call.
- The initial `test` call (writing the failing test) sits **outside** cycle 1's implement/validate and does not consume budget.
- Only **Blocker** and **Major** validate findings trigger a retry.
- **Minor** and **Nit** findings are collected into the slice's `findingsDeferred` list and surfaced on the closing card. They do not retry.

### Recurrence detector

- After each validate call, compare new Blocker/Major finding IDs to the previous cycle's findings **in the same slice**.
- If any ID repeats two cycles in a row, **pause the slice immediately** — do not burn cycle 3. Print a pause card naming the recurring ID(s) and ask the user for guidance.
- On resume, the recurrence counter for that ID resets and the cycle 3 budget is intact.

### Soft cap

- **2 consecutive paused slices** → supervisor halts and asks the user to re-scope the slice list. Print a re-scope card with all open findings and the suggestion to run `/define` to amend the spec.

### End-of-slice tripwire

- After a slice converges, run `npx eslint <touched-files>` scoped to the files the slice changed. Non-zero exit = remediation sub-cycle within the same slice (counts against the 3-cycle budget).
- Do **not** run a full `npm run build` or `npx vitest run` mid-feature — too expensive per slice.

### End-of-feature preflight

- After all slices converge, invoke `/preflight` (lint + vitest + build). **Blocking.**
- Failure spawns a synthetic remediation slice with a fresh 3-cycle budget. If that too fails to converge, supervisor pauses with a re-scope ask.

## Pseudocode

```
parseSpec(specPath) -> slices[]
initState(slug)
for slice in slices:
  markTodoInProgress(slice)
  invokeTest(slice)                   # writes failing test; no cycle consumed
  lastFindings = {}
  for cycle in 1..3:
    printMarker("implement", cycle)
    invokeImplement(slice)
    printMarker("validate", cycle)
    findings = invokeValidate(slice)
    blockersAndMajors = filter(findings, sev in [Blocker, Major])
    if blockersAndMajors is empty:
      break
    if any id in blockersAndMajors also in lastFindings:
      pauseSlice(slice, reason="recurrence", findings=blockersAndMajors)
      awaitUser()
      # on resume, reset lastFindings and re-run the same cycle index
      # (decrement so the for-loop's increment lands us back on `cycle`)
      lastFindings = {}
      cycle = cycle - 1
      continue
    lastFindings = blockersAndMajors
    if cycle == 3:
      pauseSlice(slice, reason="budget-exhausted", findings=blockersAndMajors)
      awaitUser()
  runScopedEslint(slice.filesTouched)
  updateState(slice, status)
  renderStatusCard(slice)
  markTodoComplete(slice)
  trimFindingsLedger()
  if pausedSlicesInARow >= 2: requestRescope()
invokePreflight()  # blocking
renderClosingCard()
```

## Status card templates

### Opening card (printed once, before slice 1)

```markdown
### /supervise — opening

- Spec: `<spec-path>`
- Slices parsed: <n>
    1. `<slice-name>` — <one-line scope>
    2. ...
- Total budget: <n> slices × 3 cycles
- State file: `.claude/state/supervise-<slug>.json`
- Mode: <default | verbose>
```

### Per-slice card (printed when a slice converges)

```markdown
### Slice: <slice-name>  ·  <status-emoji or text>

- Cycles used: <n> / 3
- Findings resolved: <count> (<Blocker/Major breakdown>)
- Findings deferred (Minor/Nit): <count>
    - `<finding-id>` — <one-line summary>
- Files touched:
    - <abs-path-or-repo-relative>
- Loop-budget accounting: <cycles-used> consumed, <cycles-remaining> remaining this slice
- Next: <next-slice-name> | (all slices complete, running preflight)
```

### Pause card (recurrence or budget-exhausted)

```markdown
### Slice paused: <slice-name>  ·  reason: <recurrence | budget-exhausted>

- Cycle: <n> / 3
- Recurring / unresolved findings:
    - `<finding-id>` (<severity>) — <verbatim summary>
- State written: `.claude/state/supervise-<slug>.json`

**Amend the slice, provide guidance, or abort?**
```

### Closing card (printed once, after preflight)

```markdown
### /supervise — closing

- Total cycles across all slices: <n>
- Findings resolved by severity:
    - Blocker: <n>
    - Major: <n>
- Findings deferred (Minor/Nit) — listed verbatim:
    - `<finding-id>` (<severity>, slice `<slice-name>`) — <summary>
- All files touched:
    - <path>
- Preflight: <green | failed → remediation slice spawned>
- <next-step sentence, e.g. "Preflight green. Ready for PR.">
```

## Abort and resume contract

- **Pause between slices**: user types `pause` / `stop` / `abort` in plain chat. Supervisor acknowledges, writes latest state to scratch JSON, does not start the next slice.
- **Pause mid-slice (user interrupt)**: on resume, supervisor reads scratch JSON, then runs `git status` and asks: *"You have in-progress changes from slice `<name>` (cycle `<n>`). Discard and retry the slice, or keep for manual review and skip to the next slice?"* No silent continuation.
- **Resume command**: re-running `/supervise <same-spec-path>` detects the scratch JSON and offers: *"Previous run paused at slice `<name>` (cycle `<n>`). Resume, restart, or abandon?"*
- **Abandon**: deletes the scratch JSON; user drives manually from there.
- **Hard failure** (e.g. child agent errors out): treated as a paused slice; user is asked to intervene.

## Verbose vs default mode

- **Default** (`/supervise <spec-path>`): print only the opening card, single-line progress markers (e.g. `→ entering implement (cycle 2)`), per-slice cards on convergence, pause cards when paused, and the closing card. Child-agent narration is suppressed.
- **Verbose** (`/supervise <spec-path> --verbose`): stream child-agent narration inline as each `test` / `implement` / `validate` runs, in addition to the cards and markers.

## TDD edge case: non-code slices

A slice composed purely of non-testable changes (for example, adding a few i18n keys with no logic) may have no meaningful failing test. In that case, the `test` subagent must explicitly state *"no meaningful test possible for this slice"* and the supervisor accepts that and proceeds to `implement` without a failing test. The `validate` agent then enforces the Quality Bar (locale-key parity, etc.) instead. Do **not** synthesize a trivial test just to satisfy TDD; that creates noise for the validator.

## What the supervisor never does

- **Never auto-edit the spec.** If the spec needs amending mid-run, route through `/define` in-place and get user approval; the supervisor itself only writes to the scratch JSON.
- **Never run `npm run build` mid-feature.** Build only runs once, inside the end-of-feature `/preflight`.
- **Never auto-open a PR.** The supervisor stops at *"ready for PR"*; the user opens the PR.
- **No parallel slices.** Slices are strictly sequential.
- **No cross-session persistence.** The scratch JSON is session-scoped; a multi-day run is not supported. On a stale scratch file, prompt the user (resume / restart / abandon).
- **No new subagent definitions.** The supervisor reuses the existing `test`, `implement`, `validate` agents unchanged.

## Acceptance-criteria self-check

This playbook implements the acceptance criteria listed in `docs/specs/supervisor-agent.md` under **Acceptance criteria**. Before declaring the feature complete, walk that list and confirm each item is honored by the behavior above.

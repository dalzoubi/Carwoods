# Supervisor agent (`/supervise`)

**Status:** Draft
**Owner:** Dennis Alzoubi
**Last updated:** 2026-04-24

## Summary

A new `/supervise <spec-path>` slash command that autonomously runs the existing `implement` → `test` → `validate` loop as a TDD team, one slice of the spec at a time, so the user does not have to manually route between phases for small and medium features. The supervisor is a playbook-driven orchestrator: a single main agent reads a playbook at `.claude/commands/supervise.md` and invokes the existing test / implement / validate subagents via the Agent tool — one level of nesting, no new subagent definition.

The supervisor respects strict per-slice loop budgets, a recurrence detector, and the full CLAUDE.md Quality Bar (injected into every child-agent prompt). It surfaces progress via per-slice status cards, supports pause/stop between slices, and has a defined abort/resume contract.

## Goals

- Collapse the define → implement → test → validate → fix → preflight manual routing into a single command for small and medium features.
- Enforce TDD rigor: failing test is written **before** implementation for every slice.
- Keep Blocker/Major findings from Validate bounded: max 3 implement→validate cycles per slice, with recurrence detection.
- Preserve the Quality Bar (reuse, i18n, a11y, privacy, error handling) by injecting a distilled contract block into every child-agent prompt.
- Keep the user in control: pause/stop between slices, explicit re-scope asks when budgets are exhausted, and an abort/resume contract when interrupted mid-slice.
- Be observable: per-slice status cards, single-line progress markers, optional `--verbose` narration.

## Non-goals

- Replacing `/define` — the supervisor does not author specs, though it can offer to invoke `/define` in-place if the spec lacks an Implementation slices section.
- Replacing `/preflight` — end-of-feature preflight is delegated to the existing command.
- Parallel slice execution. Slices run strictly sequentially (see Out of scope).
- A persistent cross-session job queue. State is scoped to a single run; the scratch file exists only to survive pause/resume within the session.
- Automating portal-secrets or migration deploys. Infra changes are out of scope for autonomous execution and require manual confirmation.
- A new mechanical lint skill. The separate `quality-bar-check` skill (Phase 2) is deferred to its own spec.

## User-facing surface

### Command shape

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

## Workflow walkthrough (worked example)

User runs `/supervise docs/specs/tenant-profile-edit.md`.

1. Supervisor reads the spec. Locates **Implementation slices** section:
   1. `profile-form-scaffold` — add route, form skeleton, i18n keys
   2. `profile-save-api` — `PATCH /api/portal/profile`, auth guard, ownership check
   3. `profile-save-wiring` — wire form submit, toast, error handling
2. Supervisor prints an **opening card**: slice list, total budget (3 slices × 3 cycles), state-file path.
3. Initializes `TodoWrite` with three todos (one per slice), marks first `in_progress`.
4. Writes `.claude/state/supervise-tenant-profile-edit.json` with initial state.
5. For slice 1 (`profile-form-scaffold`):
   - Prints `→ entering test (cycle 1)`. Invokes `test` subagent with the Quality Bar contract + slice scope. Receives failing test files.
   - Prints `→ entering implement (cycle 1)`. Invokes `implement` subagent. Receives code changes.
   - Prints `→ entering validate (cycle 1)`. Invokes `validate` subagent. Receives findings.
   - No Blocker/Major → slice 1 converges. Runs scoped `npx eslint` on touched files (tripwire).
   - Prints slice 1 **status card**, marks todo complete, updates scratch JSON.
6. Slice 2: cycle 1 validate reports Major `VAL-AUTH-003` (missing ownership check). Retry cycle 2: implement addresses it, validate passes. Slice converges in 2 cycles. Status card shows 2 cycles used, 1 Major resolved.
7. Slice 3: cycle 1 validate reports Blocker `VAL-I18N-001` (missing `ar` key). Cycle 2 validate reports the same Blocker ID again → **recurrence detected**. Supervisor pauses before burning cycle 3, prints a **pause card** with the finding and asks user to amend or intervene.
8. User provides guidance; supervisor resumes with cycle 3 budget intact (recurrence halt does not consume cycle 3). Cycle 3 converges.
9. All slices complete. Supervisor runs end-of-feature `/preflight` (lint + vitest + build) — **blocking**. If it fails, a remediation slice is spawned with its own 3-cycle budget.
10. Prints **closing card**: total cycles, Blocker/Major count resolved, Minor/Nit findings deferred (listed verbatim), files touched, and the next-step sentence: *"Preflight green. Ready for PR."*

## Architecture and state

### Components

- **`.claude/commands/supervise.md`** — the playbook. Contains orchestration rules, the Quality Bar contract block, loop pseudocode, status-card template, abort/resume script, refusal rules. This is the entire implementation surface; no new subagent definition file is added.
- **Main agent (driven by playbook)** — reads `<spec-path>`, parses Implementation slices, invokes the existing `test` / `implement` / `validate` subagents via the Agent tool.
- **Existing subagents** (unchanged) — `.claude/agents/test.md`, `implement.md`, `validate.md`. Supervisor passes each one a prompt prefixed with the Quality Bar contract plus slice scope.

### Agent graph

```
user
 └─ /supervise (main agent, playbook-driven)
     ├─ Agent: test        (per slice, per cycle)
     ├─ Agent: implement   (per slice, per cycle)
     └─ Agent: validate    (per slice, per cycle)
```

One level of nesting only. Subagents do not invoke other subagents.

### State

**In-session:**
- `TodoWrite` — one todo per slice; exactly one `in_progress` at a time.
- In-context findings ledger — running list of resolved and deferred findings, summarized into status cards and trimmed between slices to manage context window.

**Durable (session-scoped, gitignored):**
- `.claude/state/supervise-<slug>.json` — written between slices and on pause. Schema below.

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

## Loop semantics

### Per-slice budget

- Max **3** implement→validate cycles. Each cycle = one `implement` call followed by one `validate` call. The initial `test` call (writing the failing test) sits outside cycle 1's implement/validate and does not consume budget.
- Only **Blocker** and **Major** validate findings trigger a retry.
- **Minor** and **Nit** findings are collected into the slice's `findingsDeferred` list and surfaced on the closing card. They do not retry.

### Recurrence detector

- After each validate call, compare new Blocker/Major finding IDs to the previous cycle's findings in the same slice.
- If any ID repeats two cycles in a row, **pause the slice immediately** — do not burn cycle 3. Print a pause card with the recurring finding and ask the user for guidance. On resume, the recurrence counter for that ID resets and the cycle 3 budget is intact.

### Soft cap

- **2 consecutive paused slices** → supervisor halts and asks the user to re-scope the slice list. Prints a re-scope card with all open findings and the suggestion to run `/define` to amend the spec.

### End-of-slice preflight tripwire

- After slice converges, run `npx eslint <touched-files>` scoped to the files the slice changed. Non-zero exit = remediation sub-cycle within the same slice (counts against the 3-cycle budget).
- No full `npm run build` or `npx vitest run` mid-feature — too expensive per slice.

### End-of-feature preflight

- After all slices converge, supervisor invokes `/preflight` (lint + vitest + build). **Blocking.**
- Failures spawn a synthetic remediation slice with a fresh 3-cycle budget. If that too fails to converge, supervisor pauses with a re-scope ask.

### Pseudocode

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

## Quality Bar contract (prepended to every child-agent prompt)

The supervisor prepends this block to every `test`, `implement`, and `validate` invocation. Each child agent must cite which items apply before starting work.

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

## Status card format

Rendered in the main chat thread between slices.

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

**Opening card** lists the parsed slices, total budget, state file path.
**Pause card** includes the reason (`recurrence` or `budget-exhausted`), recurring finding IDs verbatim, and an explicit prompt: *"Amend the slice, provide guidance, or abort?"*
**Closing card** aggregates: total cycles across all slices, total findings resolved by severity, all deferred Minor/Nit findings listed verbatim, all files touched, preflight outcome, next-step sentence.

## Abort and resume contract

- **Pause between slices**: user types `pause` / `stop` / `abort` in plain chat. Supervisor acknowledges, writes latest state to scratch JSON, does not start the next slice.
- **Pause mid-slice (user interrupt)**: on resume, supervisor reads scratch JSON, then runs `git status` and asks: *"You have in-progress changes from slice `<name>` (cycle `<n>`). Discard and retry the slice, or keep for manual review and skip to the next slice?"* No silent continuation.
- **Resume command**: re-running `/supervise <same-spec-path>` detects the scratch JSON and offers: *"Previous run paused at slice `<name>` (cycle `<n>`). Resume, restart, or abandon?"*
- **Abandon**: deletes the scratch JSON; user drives manually from there.
- **Hard failure** (e.g. child agent errors out): treated as a paused slice; user is asked to intervene.

## Preflight integration

- **Per-slice tripwire**: `npx eslint <touched-files>` only. Fast, catches early regressions, keeps cycles cheap.
- **End-of-feature**: full `/preflight` command (lint + vitest + build). Blocking. Failure spawns a remediation slice with a fresh 3-cycle budget.
- The supervisor never runs a full `npm run build` mid-feature.

## Changes required to existing artifacts

- **`/define` agent** (`.claude/agents/define.md` and its spec template): add a required **Implementation slices** section. Each slice contains: `name`, `scope` (files/areas touched), `success criteria`, `dependencies on prior slices`, `estimated cycle budget if unusual (default 3)`. The Define agent must explicitly get user approval on the slice list during Q&A. *(Separate work item; call out in this spec's closing card as a prerequisite for `/supervise` to function on new specs.)*
- **`.gitignore`**: add `.claude/state/` so scratch JSON never enters the repo.
- **`CLAUDE.md` agent-workflow table**: add a `supervise` row linking `/supervise` to the playbook.

## Out of scope / deferred

- **Phase 2 `quality-bar-check` skill** — mechanical checks only (locale-key parity across en/es/fr/ar; hardcoded hex in components; physical CSS directions; missing `type="button"` on non-submit buttons in forms). Privacy, a11y semantics, and UX consistency stay with Validate. Gets its own spec.
- **Parallel slice execution** (earlier Option 3) — deferred. Sequential only.
- **Cross-session persistence** — scratch JSON is session-scoped. A multi-day run is not supported.
- **Auto-open PR** — supervisor stops at "ready for PR"; the user opens the PR.
- **Auto-edit the spec** — supervisor can read and append Spec deltas only by routing to `/define` in-place; it never silently rewrites the spec.

## Open risks

- **Main-agent context window** across many slices — mitigation: trim in-context findings ledger after every slice, keep full ledger in the scratch JSON. Recommend a **feature-size cap** of ~6 slices; beyond that, split the spec.
- **Child-agent cost amplification** — worst case: slices × 3 cycles × 3 agents = 9× single-run cost per slice. Mitigation: per-slice budget, recurrence halt, soft cap on consecutive paused slices.
- **Spec drift under retry** — an `implement` agent fixing a Major may introduce a new Major. Mitigation: validate every cycle; recurrence detector catches ping-pong between two findings.
- **Silent Minor/Nit accumulation** — deferred findings are easy to ignore. Mitigation: closing card lists every deferred finding verbatim with its ID and slice.
- **TDD mismatch for non-code slices** (e.g. pure i18n-key additions) — the `test` subagent may return "no meaningful test possible". Supervisor accepts this explicit declaration and proceeds to implement without a failing test; `validate` enforces the Quality Bar coverage instead.

## Acceptance criteria

- [ ] `/supervise` without an argument prints a one-line usage message and exits.
- [ ] `/supervise` on a spec missing the Implementation slices section offers to invoke `/define` in-place; declining exits cleanly.
- [ ] `/supervise` on a valid spec parses the slices and emits an opening card listing them plus total budget.
- [ ] Exactly one todo is `in_progress` at a time during execution.
- [ ] The Quality Bar contract block is present at the head of every `test` / `implement` / `validate` prompt, and each child agent begins its response by citing which items apply.
- [ ] For each slice, a `test` call happens before the first `implement` call. If no meaningful test is possible, the test agent says so explicitly.
- [ ] No slice exceeds 3 implement→validate cycles.
- [ ] A finding ID that repeats in two consecutive cycles halts the slice before cycle 3 and prints a pause card naming the recurring ID.
- [ ] Minor/Nit findings never trigger retry; they appear verbatim on the closing card with IDs and slice names.
- [ ] Scoped `npx eslint` runs after each converged slice on the slice's touched files.
- [ ] `/preflight` runs once at end of feature; failure spawns a remediation slice with a fresh 3-cycle budget.
- [ ] `.claude/state/supervise-<slug>.json` is written between slices and matches the schema above.
- [ ] Interrupting mid-slice and re-running `/supervise` triggers the resume prompt (resume / restart / abandon) and runs `git status` to ask about in-progress changes.
- [ ] Two consecutive paused slices trigger a re-scope ask.
- [ ] `.gitignore` excludes `.claude/state/` so scratch JSON cannot enter the repo.
- [ ] `/define`'s spec template includes a required Implementation slices section and the Define agent gets user approval on the slice list during Q&A.
- [ ] `--verbose` streams child-agent narration; default mode prints only cards and single-line markers.

## Spec deltas (filled during implementation)

- _None yet._

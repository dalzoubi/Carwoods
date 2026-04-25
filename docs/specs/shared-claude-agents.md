# Shared Claude agents distribution

**Status:** Draft
**Owner:** dalzoubi
**Last updated:** 2026-04-24

## Context & problem

The Carwoods repo has matured a five-agent spec-driven development workflow under `.claude/agents/` (`define`, `implement`, `test`, `validate`, `supervise`) plus matching slash commands (`/define`, `/implement`, `/test`, `/validate`, `/supervise`, `/preflight`) and a shared `validate-report-template.md`. These artifacts are deliberately project-agnostic in design — the same agents are useful in any repo that uses Claude Code with a `CLAUDE.md` and `AGENTS.md`.

Today they only exist as files in this one repo. Copying them by hand into other projects guarantees drift: bug fixes and prompt improvements made in one repo never propagate, and divergent forks accumulate. We want a single canonical source for the generic pieces and a low-friction way to keep multiple consumer repos in sync, while leaving project-specific skills and commands untouched in each repo.

## Goals / non-goals

- **Goals:**
  - One canonical content repo for the generic workflow agents, their slash commands, and the shared validate report template.
  - A CLI that consumer repos use to install and update those files into `.claude/`, scoped only to the files the shared repo owns.
  - Semver-tagged releases with a per-consumer lockfile recording the range and resolved version.
  - Tamper-evident managed files via an inline marker so the CLI can safely overwrite its own files and never touch project-local files.
  - Automated update PRs in consumer repos when the shared repo cuts a new tag.
  - Optional CI drift check that fails a build if `.claude/` no longer matches the locked version.
  - Public, installable CLI (`npm i -g @dalzoubi/claude-agents-sync`) that authenticates to the private content repo via the user's existing GitHub credentials.

- **Non-goals:**
  - Distributing **project-specific** skills or commands (`add-translation`, `theme-audit`, `azure-route-check`, `entra-config-map`, `/verify-ui`, `/i18n`) — these remain local to each consuming repo and are not managed by the CLI.
  - Replacing or wrapping `CLAUDE.md` / `AGENTS.md` content. The agents *reference* "the project's CLAUDE.md / AGENTS.md" but those files stay fully owned by each project.
  - Dependabot integration. Dependabot does not understand custom JSON manifests and is the wrong tool here.
  - Topic-based or org-wide consumer discovery for auto-PRs. Consumers are listed explicitly in a `registry.json` in the shared repo.
  - A web UI, hosted registry, or paid distribution tier.
  - Migrating existing slash commands or agents to a plugin format other than plain files in `.claude/`.

## User stories & acceptance criteria

- As a repo owner adopting the shared agents for the first time, I want to run a single command and have the canonical agents land in `.claude/` with a lockfile committed, so that I can start using `/define`, `/implement`, `/test`, `/validate`, `/supervise`, and `/preflight` immediately.
  - [ ] `npx @dalzoubi/claude-agents-sync init` writes the managed files under `.claude/` with marker headers, writes `.claude/.agents-sync.json` with `range: "^1"` and the resolved version, and prints a success summary.
  - [ ] If any target path already exists without a managed marker, init exits non-zero and lists the offending files with guidance to rename, delete, or pass `--force`.
  - [ ] `--dry-run` prints the planned writes without touching disk.

- As a maintainer of the shared repo, I want tagging a new release to open update PRs in every registered consumer, so that fixes propagate without manual work.
  - [ ] Pushing a semver tag (e.g. `v1.4.0`) in the content repo triggers a workflow that reads `registry.json` and dispatches `repository_dispatch` events at each listed consumer.
  - [ ] Each consumer's reusable sync workflow runs `update`, commits the changes, and opens a PR titled `chore(claude-agents): update to vX.Y.Z`.
  - [ ] If the consumer is already on the latest resolved version, no PR is opened.

- As a consumer repo maintainer, I want CI to fail when `.claude/` drifts from the locked version, so that ad-hoc edits to managed files can't ship silently.
  - [ ] An opt-in reusable GitHub Action runs `check` and exits 0 (in sync), 1 (drift detected), or 2 (CLI/auth error).
  - [ ] The action posts a one-line summary listing changed managed files.

- As a consumer who prefers pull-based updates, I want Renovate to track the resolved version in my lockfile, so that I don't need `repository_dispatch` plumbing.
  - [ ] Documented Renovate regex manager snippet successfully detects new tags on the shared repo and opens version-bump PRs against `.claude/.agents-sync.json`.

- As a developer hand-tuning Claude config, I want my project-specific files in `.claude/` to be left strictly alone, so that the shared CLI never overwrites local work.
  - [ ] Files without the managed marker are never modified, deleted, or moved by `init`, `update`, or any other command.

- As an operator running the CLI in CI without `gh`, I want clear authentication errors, so that I know exactly what env var to set.
  - [ ] When the content repo is unreachable due to auth, the CLI prints a single-paragraph error naming `GITHUB_TOKEN`, the required scopes, and the `gh auth login` fallback for local use, then exits 2.

## UX notes

This feature ships a CLI and templates, not a web UX. UX considerations:

- **CLI output**: Plain text, color-optional (respect `NO_COLOR`). One summary table per command. Errors single-paragraph, actionable, no stack traces by default; `--debug` prints stacks.
- **i18n**: Out of scope — CLI strings are English-only. The CLI is a developer tool, not user-facing.
- **A11y**: CLI must work with screen readers; avoid Unicode box-drawing or animations as primary information channels. Use plain ASCII tables and prefix status lines with `OK:` / `WARN:` / `ERROR:` so screen readers and grep both work.
- **Component reuse**: Use established Node CLI primitives (`commander` or `yargs`, `picocolors`, `zod` for lockfile validation). Don't hand-roll an arg parser.
- **New patterns introduced**: The `<!-- managed-by: ... -->` marker convention is new. Documented in the shared repo's README.

## Error handling & logging

Failure modes for the CLI:

- **Network / GitHub unreachable** — `ERROR: Could not reach github.com to fetch claude-agents@<resolved>. Check your network and retry.` Exit 2.
- **Auth failure (401/403)** — `ERROR: Authentication to dalzoubi/claude-agents failed. Set GITHUB_TOKEN with 'repo' scope, or run 'gh auth login' locally. See <docs URL>.` Exit 2.
- **Version not found (404 on tag)** — `ERROR: Version vX.Y.Z not found. Run 'claude-agents-sync status' to see available tags.` Exit 2.
- **Unmanaged collision** — `ERROR: <path> exists and is not managed by claude-agents-sync. Rename, delete, or rerun with --force to adopt.` Exit 1.
- **Lockfile parse error** — `ERROR: .claude/.agents-sync.json is invalid: <zod error summary>. Delete and rerun init, or restore from git.` Exit 1.
- **Range resolves to no compatible version** — `ERROR: Range '<range>' has no matching releases. Latest is vX.Y.Z. Update the range in .claude/.agents-sync.json.` Exit 1.

User-facing UX surface: stderr for errors, stdout for summaries. No telemetry. No correlation IDs (single-process CLI, the user has the full output).

Server-side logging: N/A — there is no server.

GitHub Action logging: the reusable check action surfaces the CLI's stderr via standard Actions logs and `::error::` annotations on drifted files.

## Privacy

- **PII**: None collected, transmitted, stored, or logged. The CLI reads files in the user's repo, talks to GitHub, and writes files. It does not phone home.
- **Consent**: Not applicable — no analytics, no telemetry.
- **Retention**: N/A.
- **Third-party requests**: One — `api.github.com` (or `github.com` for tarball download) to fetch the tagged release archive. Authenticated via the user's own token.
- **Auth surface**: Read-only access to the private content repo via the user's `GITHUB_TOKEN` or `gh auth token`. No new auth surface in the consumer repos. The shared repo's `repository_dispatch` automation uses a per-consumer fine-grained PAT or a GitHub App installation (decision deferred to implementation; see Open questions).
- **Secrets**: The CLI never persists tokens. It reads them from env or `gh` and uses them in-memory only.

## Architecture

### Components

1. **Content repo** (`dalzoubi/claude-agents`, private GitHub):
   - `agents/` — the five workflow agent markdown files.
   - `commands/` — slash command markdown files (`define.md`, `implement.md`, `test.md`, `validate.md`, `supervise.md`, `preflight.md`).
   - `templates/validate-report-template.md`.
   - `manifest.json` — declarative listing of every managed file with target path under `.claude/`, content hash, and metadata. The CLI consumes this to know what to write where.
   - `registry.json` — explicit list of consumer repos for push-based PRs.
   - `.github/workflows/release-dispatch.yml` — fires `repository_dispatch` to each consumer on tag push.
   - `.github/workflows/sync-update.yml` — reusable workflow consumers reference via `uses: dalzoubi/claude-agents/.github/workflows/sync-update.yml@v1`.
   - `.github/actions/check/action.yml` — reusable composite action wrapping `claude-agents-sync check`.
   - `README.md` — adoption guide, marker format, lockfile schema, Renovate snippet.

2. **CLI** (`@dalzoubi/claude-agents-sync`, public npm package):
   - Node 20+, ESM, no TypeScript runtime dependency (compile to JS for publish).
   - Single binary `claude-agents-sync` and shorthand `cas`.
   - Subcommands: `init`, `update`, `status`, `check`, `diff`. Global flag `--dry-run`. Global flag `--debug`.

3. **Consumer repo additions** (per consumer):
   - `.claude/.agents-sync.json` (lockfile, committed).
   - Managed files under `.claude/agents/`, `.claude/commands/`, `.claude/templates/` carrying marker headers.
   - Optional `.github/workflows/claude-agents-sync.yml` referencing the reusable update workflow.
   - Optional CI step using the check action.

### Data flow — `update`

1. CLI reads `.claude/.agents-sync.json` to get `range` and `resolvedVersion`.
2. CLI authenticates to GitHub (env token, then `gh auth token` fallback).
3. CLI lists tags on `dalzoubi/claude-agents`, picks highest semver matching `range`.
4. If higher than `resolvedVersion`, fetch tarball for that tag.
5. Read `manifest.json` from tarball; for each entry:
   a. Compute target path under `.claude/`.
   b. If target exists with no managed marker and `--force` not set → collect into "collision" list.
   c. Otherwise write file with marker header `<!-- managed-by: claude-agents-sync vX.Y.Z -->` injected at the top.
6. Remove any locally-managed file that is no longer in the manifest (handles deletions across versions).
7. If collisions and not `--force`: exit 1 with the list. Otherwise update lockfile's `resolvedVersion` and exit 0.

### Data flow — push-based PR

1. Maintainer tags `vX.Y.Z` in the content repo and pushes the tag.
2. `release-dispatch.yml` runs, reads `registry.json`, and for each consumer calls `gh api repos/<owner>/<repo>/dispatches` with event_type `claude-agents-update` and a payload `{ version: "vX.Y.Z" }`.
3. Each consumer's `claude-agents-sync.yml` listens for `repository_dispatch` with that event_type, runs the reusable workflow:
   - Checks out, sets up Node, runs `npx @dalzoubi/claude-agents-sync update`.
   - If the working tree is dirty, creates a branch, commits, and opens a PR using `peter-evans/create-pull-request` or `gh pr create`.
   - Title: `chore(claude-agents): update to vX.Y.Z`. Body: changelog excerpt from the GitHub release.

### Data flow — drift check

1. CI step runs the check action.
2. Action runs `claude-agents-sync check`, which:
   a. Loads lockfile.
   b. Fetches tarball for `resolvedVersion`.
   c. For each managed file in manifest, compares the on-disk content (after stripping the marker header) to the tarball content.
   d. Reports any mismatch, missing file, or unexpected extra managed file.
3. Exit code 0 / 1 / 2 as documented above.

### API routes / DB schema deltas / Shared packages

None. This is a standalone CLI plus content repo. No backend service, no database.

## Risks & open questions

- **Marker stripping vs. comparison**: agent markdown files are read by Claude Code itself; an HTML-style comment at the top is fine in markdown but we need to confirm Claude doesn't render the marker as visible content in any rendering path. Plan: place the marker as a markdown HTML comment on line 1; verify by manual inspection in the implementation phase.
- **Slash command files**: confirm `.claude/commands/*.md` tolerate a leading HTML comment without breaking the command parser. Implementation phase verifies this with a smoke test in a throwaway repo.
- **Registry maintenance**: `registry.json` is a manual list. For now this is fine (low consumer count). Long-term we may add a self-registration command, but out of scope for v1.
- **Auth for `repository_dispatch`**: needs either a fine-grained PAT with `actions:write` per consumer, or a GitHub App with `metadata:read` + `contents:write` + `actions:write` installed on each consumer. Decision: ship with PAT-based dispatch for v1 (simpler, no app to maintain); document the App migration path for v2.
- **Renovate regex manager**: needs validation that `github-releases` datasource respects pre-release tags appropriately. Plan: in the documented snippet, set `extractVersion` and `versioning: semver-coerced` to skip pre-releases unless explicitly tagged stable.
- **Versioning of the manifest format itself**: if `manifest.json` schema changes incompatibly, older CLIs will break against newer content. Plan: include `manifestSchemaVersion` in `manifest.json`; the CLI rejects unknown major schema versions with a clear "upgrade the CLI" error.

## Rollout & rollback

- **Phase 1 — content repo and CLI**: stand up `dalzoubi/claude-agents` with the current Carwoods agents stripped of project-specific language. Publish CLI v1.0.0 to npm. Tag content `v1.0.0`.
- **Phase 2 — Carwoods adoption**: in this repo, add markers to existing managed files, commit `.claude/.agents-sync.json` pinning `^1`, install the CI check workflow. No PR auto-update on Carwoods until phase 4.
- **Phase 3 — second consumer**: onboard one more repo to validate the flow end-to-end before broadcasting.
- **Phase 4 — push-based PRs**: enable `release-dispatch.yml` against the registry.
- **Rollback**: at any point, a consumer can delete `.claude/.agents-sync.json` and the workflow file; the managed files become normal project files (the marker is harmless). The shared repo can revert a bad release by re-tagging or by publishing a `v1.X.(Y+1)` patch with the fix.

- **Feature flag**: not needed; the CLI is opt-in per consumer.
- **Migration reversibility**: yes, fully — uninstalling is `git rm` of the lockfile and the workflow.
- **Deploy order**: content repo + CLI must ship before any consumer can adopt. Push-based PRs require the registry to be populated before the first tag dispatch is meaningful.

## Test plan

- **Unit (CLI)**:
  - Lockfile parse / validation (zod schema).
  - Marker injection and stripping round-trip.
  - Semver range resolution against a fixture tag list.
  - Manifest application: writes, deletions, collisions, force.
- **Integration (CLI)**:
  - Run against a local fixture tarball and assert the resulting `.claude/` tree byte-for-byte.
  - Auth fallback chain: env token present, env absent + `gh` present, both absent.
  - `--dry-run` makes no filesystem changes.
- **End-to-end**:
  - Spin up an ephemeral test consumer repo via GitHub API; run `init`, `update`, `check`, assert PR created on dispatch.
- **CI workflow tests**:
  - The reusable update workflow runs in a sandbox repo and produces a PR.
  - The check action exits with the right codes for in-sync, drifted, and auth-failure scenarios.
- **Manual verification**:
  - `init` in a fresh repo, in a repo with conflicting unmanaged files, in a repo that already has the lockfile.
  - Tag dispatch in the content repo opens PRs in two test consumers within 5 minutes.

## Implementation slices

Sequenced for `/supervise`. Each slice is independently shippable and ends with a passing test suite.

1. **content-repo-bootstrap**
   - **Scope:** Create `dalzoubi/claude-agents` with `agents/`, `commands/`, `templates/`, generic-language versions of the five workflow agents, the six slash commands, and the validate report template. Author `manifest.json` and `registry.json`. README documenting marker format and lockfile schema.
   - **Success criteria:** Repo exists, all generic files lint as valid markdown, `manifest.json` validates against its own schema. Tag `v1.0.0` cut.
   - **Dependencies:** none.

2. **cli-core**
   - **Scope:** `@dalzoubi/claude-agents-sync` package. Implement `init`, `update`, `status`, `diff`, with `--dry-run` and `--debug`. Lockfile read/write. Marker header injection and detection. GitHub auth chain (env → `gh`). Tarball fetch and apply. Unit + integration tests.
   - **Success criteria:** Against a local fixture tarball, `init` and `update` produce the expected tree; collisions are refused without `--force`; lockfile round-trips. Published to npm as `1.0.0`.
   - **Dependencies:** content-repo-bootstrap.

3. **cli-check-and-action**
   - **Scope:** `check` subcommand with 0/1/2 exit codes. `.github/actions/check/action.yml` composite action in the content repo wrapping it. Documentation snippet for adding the action to a consumer's CI.
   - **Success criteria:** Action runs green on a clean consumer fixture, red on a hand-edited managed file, exit 2 on auth failure.
   - **Dependencies:** cli-core.

4. **push-based-auto-pr**
   - **Scope:** `release-dispatch.yml` in the content repo iterating `registry.json`. Reusable `sync-update.yml` workflow consumers can `uses:`. Documentation for adding it to a consumer with the required PAT secret.
   - **Success criteria:** Tagging `v1.0.1` in the content repo opens a PR in a sandbox consumer within 5 minutes; PR title and body match spec.
   - **Dependencies:** cli-core.

5. **renovate-and-docs**
   - **Scope:** Documented Renovate regex manager snippet, README adoption guide covering both push-based and Renovate flows, troubleshooting section for common auth and collision errors.
   - **Success criteria:** Renovate dry-run on a sandbox consumer detects a new tag and proposes a lockfile bump.
   - **Dependencies:** cli-core.

6. **carwoods-adoption**
   - **Scope:** In this repo, add managed-by markers to the five agents, the six commands, and the validate template. Commit `.claude/.agents-sync.json` with `range: "^1"`. Add the check action to the existing CI. Optionally subscribe to push-based PRs.
   - **Success criteria:** `claude-agents-sync check` passes locally and in CI on `main`. No behavioral change to existing slash commands.
   - **Dependencies:** all prior slices.

## Out of scope / future work

- Distributing project-specific skills (`add-translation`, `theme-audit`, `azure-route-check`, `entra-config-map`).
- Distributing project-specific commands (`/verify-ui`, `/i18n`).
- Web UI / dashboard for consumer status.
- Telemetry of any kind.
- Self-registration command for consumers.
- GitHub App migration (PAT is sufficient for v1).
- Mirroring to a public CDN to avoid the GitHub auth requirement.
- Multi-tenancy: forks of the content repo for orgs that want their own canonical agents — interesting, but defer.

## Spec deltas (filled during implementation)

- _none yet_

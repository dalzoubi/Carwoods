---
description: Start the Implement agent to build from a spec or small task, with human checkpoints.
---

Delegate to the **implement** subagent.

Spec path or task description: $ARGUMENTS

If the argument is a path under `docs/specs/` or `docs/portal/specs/`, read that spec first. If the spec is missing or thin, stop and tell the user to run `/define`. For any non-trivial change, use the Plan subagent to draft an implementation plan and **wait for the user's approval** before editing. Work in small chunks; after each chunk run `npx vitest run` (logic changes) / `npm run build` (Vite/env changes) / `npx eslint src/` and stop for review. Stop before any "Ask first" action (new deps, route changes, payload changes, design tokens, analytics) or destructive action. Do not invoke Test or Validate — tell the user when to run `/test` or `/validate`.

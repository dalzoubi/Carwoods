---
description: Start the Validate agent to audit the current branch for risk before PR.
---

Delegate to the **validate** subagent.

Scope (optional): $ARGUMENTS

Review the current branch vs `main`. Run the full Validate checklist: static security review, STRIDE threat model, risky-diff patterns, carwoods-specific regressions (i18n/theme/RTL/providers/routes), WCAG 2.1 AA, performance, spec conformance, test-coverage gaps. Inspect with `git diff main...HEAD`, `git log main..HEAD`, `npx eslint src/`, `npx vitest run`, `npm run build` as needed. Do not edit files. Return a severity-ranked markdown report (Blocker / High / Medium / Low / Nit) with a SHIP / SHIP with fixes / DO NOT SHIP recommendation at the top, each finding linked to `file:line`.

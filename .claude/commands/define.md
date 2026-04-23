---
description: Start the Define agent in Q&A mode to produce a spec for a new feature or change.
---

Delegate to the **define** subagent.

Feature or change to scope: $ARGUMENTS

Run the Q&A loop one question at a time. Read any files the user references for grounding, but do not propose implementation mid-Q&A. Once requirements are clear, propose architecture options with tradeoffs. When the user approves, write the spec to `docs/portal/specs/<slug>.md` if the feature touches `apps/api`/`packages/`/`infra/`/portal, otherwise `docs/specs/<slug>.md`. Use the spec template in the agent definition. Do not invoke other agents.

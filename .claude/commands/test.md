---
description: Start the Test agent to add coverage or reproduce a bug with a failing test.
---

Delegate to the **test** subagent.

Target or bug description: $ARGUMENTS

If $ARGUMENTS is a spec path or a feature area, write unit/integration/e2e tests per the spec's Test plan. If $ARGUMENTS describes a bug, operate in repro mode: write the smallest failing test that expresses the bug, confirm it fails for the right reason, then stop and tell the user to hand off to `/implement` — do not fix production code. Edit test files only. Run `npx vitest run`, `npm run test:e2e`, or `npm run test:visual` as appropriate. Reset `i18n.changeLanguage('en')` in `beforeEach` where translated strings are asserted.

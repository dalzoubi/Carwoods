# Spec Template

Use this template for every non-trivial change before implementation.

## 1) Context

- Problem statement:
- Why now:
- Related docs/issues/links:
- Base prompt/rules to follow (required):
  - `AGENTS.md` (workspace rules)
  - `docs/portal/IMPLEMENTATION_PROMPT.md` (or feature-area equivalent)

## 2) Scope

- In scope:
- Out of scope:

## 3) Users and stories

- As a `<user role>`, I want `<goal>`, so that `<benefit>`.

## 4) Constraints and assumptions

- Technical constraints:
- Product/design constraints:
- Security/privacy constraints:
- Assumptions:

## 5) Acceptance criteria

Write criteria in testable form. Prefer Given / When / Then.

1. Given ...
   When ...
   Then ...

2. Given ...
   When ...
   Then ...

## 6) Validation plan

- Automated checks (include exact commands):
  - Base-prompt compliance check (required): confirm implementation and validation follow the listed base rules/prompts.
  - `npx vitest run`
  - `npx eslint src/`
  - (add feature-specific checks)
- Required test plan details (required):
  - New tests to add (exact file paths):
  - Existing tests to update (exact file paths):
  - Acceptance criteria to test mapping (AC -> test file/test case):
- Manual checks:
  - Light mode
  - Dark mode
  - `/dark/...` forced preview (if route-related)
  - Arabic/RTL
  - Print preview (if UI is affected)

## 7) Implementation plan

- Step 1:
- Step 2:
- Step 3:

## 8) Risks and mitigations

- Risk:
  - Mitigation:

## 9) Rollback plan

- If deployment fails/regresses:

## 10) Traceability and completion

- Files changed:
- Tests run and results:
- Base-prompt compliance status:
  - `AGENTS.md` constraints: met / deferred (reason)
  - Feature implementation prompt constraints: met / deferred (reason)
- Acceptance criteria status:
  - AC-1: met / deferred (reason)
  - AC-2: met / deferred (reason)
- Follow-ups (if any):

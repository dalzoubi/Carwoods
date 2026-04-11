## Summary

- What changed:
- Why:

## Spec-driven checklist

- [ ] I created or updated a spec in `docs/specs/` before or alongside implementation.
- [ ] I validated that implementation scope matches the spec (no untracked out-of-scope drift).
- [ ] I mapped acceptance criteria to verification steps (tests/manual checks).
- [ ] If requirements changed during implementation, I updated the spec first.

## Baseline metadata checklist (when feature ownership/criticality changes)

- [ ] I updated the affected baseline spec metadata in `docs/specs/baseline/<feature>.md` (`Priority`, `Owner`).
- [ ] I updated the `docs/specs/baseline/README.md` metadata index in the same PR.
- [ ] I documented why the priority/owner changed in this PR description.

## Validation

- Commands run:
  - [ ] `npx vitest run`
  - [ ] `npx eslint src/`
  - [ ] Other (list):

- Manual checks performed (as relevant):
  - [ ] Light mode
  - [ ] Dark mode
  - [ ] `/dark/...` preview
  - [ ] RTL (Arabic)
  - [ ] Print preview

## Notes

- Risks / follow-ups:

# Story: Git integration (commit + diff)

**Status**: To Do

---

## Related Requirement

[Minimal Server: git.ts; ApplyOps output]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- Commits created on each write with summary; returns diff.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [ ] Wire simple-git, author from env, fallback defaults.
- [ ] Build commit message from ops summary.
- [ ] Return diff in output.

## Notes

- Respect original line endings in diffs.

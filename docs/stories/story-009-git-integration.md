# Story: Git integration (commit + diff)

**Status**: Done

---

## Related Requirement

[Minimal Server: git.ts; ApplyOps output]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- Commits created on each write with summary; returns diff.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Wire simple-git, author from env, fallback defaults.
- [x] Build commit message from ops summary.
- [x] Return diff in output.

## Notes

- Respect original line endings in diffs.

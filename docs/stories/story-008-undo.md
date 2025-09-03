# Story: Undo tool

**Status**: Done

---

## Related Requirement

[Tooling: project.undo]

## Alignment with Design

[Design: Workflow recovery]

## Acceptance Criteria

- Reverts by commit and returns revert_commit + diff.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement revert via git.
- [x] Validate commit exists and belongs to the vault repo.

## Notes

- Consider safety on large rebases.

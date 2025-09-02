# Story: Undo tool

**Status**: In Progress

---

## Related Requirement

[Tooling: project.undo]

## Alignment with Design

[Design: Workflow recovery]

## Acceptance Criteria

- Reverts by commit and returns revert_commit + diff.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [ ] Implement revert via git.
- [ ] Validate commit exists and belongs to the vault repo.

## Notes

- Consider safety on large rebases.

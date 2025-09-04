# Story: Reliable undo validation

**Status**: Done

---

## Related Requirement

[Git integration and revert]

## Alignment with Design

[Design: Deterministic testing]

## Acceptance Criteria

- AI_TESTING performs a dedicated append then immediately reverts it.
- Workdir cleanliness check allows `.project-agent/**` but blocks other changes.
- Undo returns revert_commit and diff or explains skip when no repo.

## Tasks

- [x] Keep `.project-agent/.gitignore` enforcement in write paths.
- [x] Ensure revert conflicts are surfaced with standardized error.
- [x] Update AI_TESTING to use dedicated append for undo.

## Notes

- Merge commits remain unsupported; document clearly.

# Story: Read-only mode

**Status**: To Do

---

## Related Requirement

[Configuration and Operational Behavior: Read-only mode]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- When READONLY=true, applyOps/create/undo return READ_ONLY errors.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [ ] Add env flag and guard in write paths.
- [ ] Return standardized error object with code READ_ONLY.
- [ ] Tests for read-only enforcement.

## Notes

- Ensure health/version still work.

# Story: Read-only mode

**Status**: Done

---

## Related Requirement

[Configuration and Operational Behavior: Read-only mode]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- When READONLY=true, applyOps/create/undo return READ_ONLY errors.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Add env flag and HTTP guard for non-GET requests.
- [x] Add MCP tool-level guards for write tools (apply/create/undo).
- [x] Return standardized error object with code READ_ONLY.
- [x] Tests for read-only enforcement.

## Notes

- HTTP layer blocks non-GET; ensure MCP handlers return proper error objects.
- Ensure health/version still work.

# Story: Head commit tool

**Status**: Done

---

## Related Requirement

[Optimistic concurrency setup]

## Alignment with Design

[Design: Tooling helpers]

## Acceptance Criteria

- `project_head_commit` returns the current git HEAD SHA or null when repo missing.
- Used in AI_TESTING to set up expectedCommit tests.

## Tasks

- [x] Implement tool
- [x] Document usage in AI_TESTING

## Notes

- Fallback to snapshot.current_commit when head is null.

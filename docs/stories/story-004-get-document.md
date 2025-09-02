# Story: GetDocument tool

**Status**: Done

---

## Related Requirement

[Tooling: project.getDocument]

## Alignment with Design

[Design: Workflow full-context path]

## Acceptance Criteria

- Returns full content, frontmatter, path, size_bytes, current_commit, date_local, tz.
- Handles large files efficiently.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement read with locking.
- [x] Include current_commit and metadata.
- [x] Tests for big files and non-UTF-8 edge cases.

## Notes

- Preserve original line endings.

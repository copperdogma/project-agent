# Story: GetDocument tool

**Status**: To Do

---

## Related Requirement
[Tooling: project.getDocument]

## Alignment with Design
[Design: Workflow full-context path]

## Acceptance Criteria
- Returns full content, frontmatter, path, size_bytes, current_commit, date_local, tz.
- Handles large files efficiently.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks
- [ ] Implement read with locking.
- [ ] Include current_commit and metadata.
- [ ] Tests for big files and non-UTF-8 edge cases.

## Notes
- Preserve original line endings.

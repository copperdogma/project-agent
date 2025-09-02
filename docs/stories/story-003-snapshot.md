# Story: Snapshot tool

**Status**: To Do

---

## Related Requirement

[Tooling: project.snapshot]

## Alignment with Design

[Design: Workflow step 1; Tooling & Conventions]

## Acceptance Criteria

- Returns frontmatter, toc, per_section_tail, anchors_index, recent_ops, current_commit, date_local, tz.
- Preserves existing section order.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [ ] Parse sections and anchors.
- [ ] Build toc and per-section tails (configurable count).
- [ ] Compute current_commit via git.
- [ ] Unit tests on large files.

## Notes

- Tails default to 10 lines per section.

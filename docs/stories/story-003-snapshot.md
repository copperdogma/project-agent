# Story: Snapshot tool

**Status**: Done

---

## Related Requirement

[Tooling: project.snapshot]

## Alignment with Design

[Design: Workflow step 1; Tooling & Conventions]

## Acceptance Criteria

- Returns frontmatter, toc, per_section_tail, anchors_index, recent_ops, current_commit, date_local, tz.
- Preserves existing section order.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Parse sections and anchors.
- [x] Build toc and per-section tails (configurable count).
- [x] Compute current_commit via git.
- [x] Unit tests on large files.

## Notes

- Tails default to 10 lines per section.

# Story: ApplyOps engine (append/move/update/delete)

**Status**: To Do

---

## Related Requirement

[Tooling: project.applyOps; Behavior; Error Model]

## Alignment with Design

[Design: Tooling & Conventions; Workflow]

## Acceptance Criteria

- Deterministic ops with anchors; preserves section order.
- Validates formats, dedup rules, returns commit+diff+summary.
- Supports expected_commit, idempotency_key.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [ ] Implement append with YYYYMMDD and anchor generation.
- [ ] Implement move_by_anchor across/within sections (tail placement).
- [ ] Implement update_by_anchor and delete_by_anchor.
- [ ] Dedup by exact text or normalized URL+trim.
- [ ] Git commit and diff; primary_anchors.
- [ ] Error codes for missing anchors, validation, conflict.

## Notes

- Per-file lock during writes.

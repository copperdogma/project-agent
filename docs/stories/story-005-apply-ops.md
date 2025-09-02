# Story: ApplyOps engine (append/move/update/delete)

**Status**: Done

---

## Related Requirement

[Tooling: project.applyOps; Behavior; Error Model]

## Alignment with Design

[Design: Tooling & Conventions; Workflow]

## Acceptance Criteria

- Deterministic ops with anchors; preserves section order.
- Validates formats, dedup rules, returns commit+diff+summary.
- Supports expected_commit, idempotency_key.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement append with YYYYMMDD and anchor generation.
- [x] Implement move_by_anchor across/within sections (tail placement).
- [x] Implement update_by_anchor and delete_by_anchor.
- [x] Dedup by exact text or normalized URL+trim.
- [x] Git commit and diff; primary_anchors.
- [x] Error codes for missing anchors, validation, conflict.

## Notes

- Per-file lock during writes.

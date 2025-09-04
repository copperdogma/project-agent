# Story: Concurrency & idempotency

**Status**: Done

---

## Related Requirement

[Optimistic concurrency; Idempotency]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- expected_commit prevents stale writes (conflict error).
- idempotency_key ensures safe retries.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Include current_commit in snapshot/getDocument.
- [x] Check expected_commit in applyOps.
- [x] Store idempotency keys (commit replay).
- [x] Add TTL and namespacing for idempotency storage; tests.

## Notes

- `current_commit` surfaced by `snapshot` and `getDocument`; `expected_commit` checked in `applyOps`.
- `idempotency_key` short-circuits with stored commit; TTL via `IDEMPOTENCY_TTL_S`; namespaced per slug under `.project-agent/idempotency/<slug>/<key>.json`.

# Story: Concurrency & idempotency

**Status**: In Progress

---

## Related Requirement

[Optimistic concurrency; Idempotency]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- expected_commit prevents stale writes (conflict error).
- idempotency_key ensures safe retries.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Include current_commit in snapshot/getDocument.
- [x] Check expected_commit in applyOps.
- [x] Store idempotency keys (commit replay).
- [ ] Add TTL and namespacing for idempotency storage; tests.

## Notes

- `current_commit` surfaced by `snapshot` and `getDocument`; `expected_commit` checked in `applyOps`.
- `idempotency_key` short-circuits with stored commit; add TTL and slug namespace.

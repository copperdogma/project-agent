# Story: Concurrency & idempotency

**Status**: To Do

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
- [ ] Include current_commit in snapshot/getDocument.
- [ ] Check expected_commit in applyOps.
- [ ] Persist idempotency keys (short TTL) for dedupe.

## Notes
- Consider namespacing keys by slug.

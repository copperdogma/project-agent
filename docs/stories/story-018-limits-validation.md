# Story: Payload limits & validation

**Status**: In Progress

---

## Related Requirement

[Configuration and Operational Behavior: Limits; Update semantics]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- Enforce snapshot ≤ 256 KB, ≤ 128 ops per call, line length ≤ 16 KB.
- Minimal format validation per section with warnings.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement size checks with standardized error PAYLOAD_TOO_LARGE.
- [x] Enforce max ops per call.
- [x] Implement line-length checks.
- [x] Document limits in README and return actionable details.

## Notes

- Wire to environment variables where appropriate with safe defaults.
- Env vars: `SNAPSHOT_MAX_BYTES` (default 256KB), `MAX_OPS_PER_CALL` (default 128), `MAX_LINE_LENGTH` (default 16384), `SNAPSHOT_TAIL`.
- Tests: `scripts/test-limits.mjs`.

# Story: Server config tool

**Status**: Done

---

## Related Requirement

[Expose server environment for tests]

## Alignment with Design

[Design: Operational introspection]

## Acceptance Criteria

- `server_config` returns IDEMPOTENCY_TTL_S, READONLY, RATE_LIMIT_WRITE_MAX, RATE_LIMIT_WRITE_WINDOW_S.
- Claude can call it to decide whether to expect idempotent replay.

## Tasks

- [x] Implement tool
- [x] Document usage in AI_TESTING

## Notes

- Keep surface minimal; expand later only if needed.

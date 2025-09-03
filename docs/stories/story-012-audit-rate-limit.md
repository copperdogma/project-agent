# Story: Auditing + rate limiting

**Status**: Done

---

## Related Requirement

[Auditing; Rate limiting]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- JSONL audit entries written on every write.
- Rate limit enforced per email and per slug with configurable limits.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement audit writer to `.project-agent/logs/audit.jsonl`.
- [x] Implement in-memory token bucket for write ops keyed by `email:slug`.
- [x] Expose limits via env vars and document.
- [x] Tests for auditing and throttling behaviors.

## Notes

- Implemented `src/audit.ts` and wired into write tools; file at `.project-agent/logs/audit.jsonl`.
- Implemented `src/rate.ts` and applied per `EMAIL_OVERRIDE:slug` with `RATE_LIMIT_WRITE_MAX`, `RATE_LIMIT_WRITE_WINDOW_S`.
- Tests: `scripts/test-audit-rate.mjs` passed.

# Story: Auditing + rate limiting

**Status**: To Do

---

## Related Requirement
[Auditing; Rate limiting]

## Alignment with Design
[Design: Tooling & Conventions]

## Acceptance Criteria
- JSONL audit entries written on every write.
- Rate limit enforced per email and per slug with configurable limits.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks
- [ ] Implement audit writer to .project-agent/logs/audit.jsonl.
- [ ] Implement in-memory token bucket for write ops.
- [ ] Configurable via env variables.

## Notes
- Ensure audit writes are robust and non-blocking.

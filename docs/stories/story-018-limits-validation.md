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

- [ ] Implement size checks with standardized error PAYLOAD_TOO_LARGE.
- [ ] Enforce max ops per call.
- [ ] Implement line-length checks.
- [ ] Document limits in README and return actionable details.

## Notes

- Wire to environment variables where appropriate with safe defaults.

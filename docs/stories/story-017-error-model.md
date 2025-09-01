# Story: Standardized error model

**Status**: To Do

---

## Related Requirement
[Error Model section]

## Alignment with Design
[Design: Tooling & Conventions]

## Acceptance Criteria
- All tools return {error:{code,message,details}} on failure.
- Canonical codes implemented: UNAUTHORIZED, FORBIDDEN_EMAIL, NOT_FOUND_ANCHOR, VALIDATION_ERROR, CONFLICT, PAYLOAD_TOO_LARGE, RATE_LIMITED, READ_ONLY, INTERNAL.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks
- [ ] Define error helpers and types.
- [ ] Replace ad-hoc errors in tool handlers.
- [ ] Tests verifying shape and codes.

## Notes
- Include hints in details when safe.

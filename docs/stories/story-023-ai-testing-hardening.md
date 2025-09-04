# Story: AI_TESTING end-to-end hardening

**Status**: Done

---

## Related Requirement

[Validation and operational testing]

## Alignment with Design

[Design: Tooling & Conventions — deterministic outputs; client guidance]

## Acceptance Criteria

- `AI_TESTING.md` uses only v2 write tools and passes end-to-end.
- Includes explicit JSON payloads for each step (append/update/move/delete, idempotency, conflict, undo).
- Provides troubleshooting guidance (paste-only input object, camelCase fields, server_config check).
- Claude Desktop runs the suite without crashing.

## Tasks

- [x] Update test flows to v2 tools.
- [x] Add snapshot-based conflict path as fallback.
- [x] Add structured report template and PASS/FAIL thresholds.
- [x] Validate locally and adjust docs based on feedback.

## Notes

- Keep steps strictly sequential to avoid race conditions.

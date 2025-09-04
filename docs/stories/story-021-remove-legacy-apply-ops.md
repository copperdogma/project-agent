# Story: Remove legacy applyOps

**Status**: To Do

---

## Related Requirement

[Client compatibility; simplified tool contracts]

## Alignment with Design

[Design: Tooling & Conventions — deprecate complex schemas]

## Acceptance Criteria

- Remove `project_apply_ops` tool registration and references.
- All write flows use v2 tools: append/update/move/delete.
- AI_TESTING has no references to `project_apply_ops` and passes end-to-end.

## Tasks

- [ ] Delete registration and tests for legacy `apply_ops`.
- [ ] Update docs (`requirements.md`, `design.md`) to reference v2 tools only.
- [ ] Verify Claude Desktop can complete validation without legacy tool.

## Notes

- Keep internal engine in `apply.ts`; only the tool surface changes.

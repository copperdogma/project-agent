# Story: Write tools v2 (append/update/move/delete)

**Status**: Done

---

## Related Requirement

[Deterministic edits; client compatibility; optimistic concurrency; idempotency]

## Alignment with Design

[Design: Tooling & Conventions — flat JSON schemas, one-action-per-tool]

## Acceptance Criteria

- Flat, explicit schemas for four tools: `project_append`, `project_update_by_anchor`, `project_move_by_anchor`, `project_delete_by_anchor`.
- Optional `expectedCommit` and `idempotencyKey` on every write.
- Returns `{commit,diff,summary,primaryAnchors,currentCommit}` same as engine today.
- Claude Desktop can execute all four without crashes or schema errors.
- AI_TESTING uses only these tools for Steps 3–6 and passes end-to-end.

## Tasks

- [x] Implement `project_append`
- [x] Implement `project_update_by_anchor`
- [x] Implement `project_move_by_anchor`
- [x] Implement `project_delete_by_anchor`
- [x] Runtime validation (types; section/anchor existence)
- [x] Audit, rate-limit, readonly guards for each tool
- [x] Update `AI_TESTING.md` to call these tools
- [ ] Remove `applyOps` mentions from docs (handled in Story 021)

## Notes

- Keep server-side aliases for snake_case if trivial, but document camelCase only.
- Reuse existing engine by adapting inputs to the shared `apply.ts` functions.

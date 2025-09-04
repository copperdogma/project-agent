# Story: Post-MVP Preview (dry-run)

**Status**: In Progress

---

## Related Requirement

[Dry-run validation of ops without writing]

## Alignment with Design

[Design: Deterministic edits; client-friendly]

## Acceptance Criteria

- `project_preview` tool accepts { slug, opsJson } where opsJson is a JSON string representing a batch.
- Returns { ok: boolean, would_change: boolean, notes: string[] }.
- Does not modify files; performs same validations as write paths (missing anchors, missing sections, payload limits).

## Tasks

- [x] Implement preview adapter: parse opsJson → internal ops
- [x] Apply engine validations without writes
- [x] Return structured result; add tests
- [ ] User must sign off on functionality before story can be marked complete.

## Notes

- Keep schema simple (string inputs) to avoid UI union issues.
- Tool: `project_preview`. Test: `scripts/test-preview.mjs`.

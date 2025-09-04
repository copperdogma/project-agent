# Story: Post-MVP Preview (dry-run)

**Status**: To Do

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

- [ ] Implement preview adapter: parse opsJson → internal ops
- [ ] Apply engine validations without writes
- [ ] Return structured result; add tests

## Notes

- Keep schema simple (string inputs) to avoid UI union issues.

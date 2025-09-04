# Story: Post-MVP Search

**Status**: Done

---

## Related Requirement

[Find anchors/sections/lines by query without fetching full document]

## Alignment with Design

[Design: Tooling — simple, flat inputs]

## Acceptance Criteria

- `project_search` accepts { slug, query, scope: "all"|"section", section?: string }.
- Returns { matches: [{ section: string, anchor?: string, excerpt: string }] }.
- Case-insensitive substring match; limit results and excerpt length.

## Tasks

- [x] Implement search with simple tokenization
- [x] Support scope=section and anchors index scan
- [x] Add limits and tests

## Notes

- Consider adding fuzzy search later; keep MVP deterministic.

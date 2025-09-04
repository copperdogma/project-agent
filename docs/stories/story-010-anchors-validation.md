# Story: Anchors & validation rules

**Status**: In Progress

---

## Related Requirement

[Anchors format; Formatting invariants; Dedup policy]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- Anchors 6–8 base36; -b suffix on collisions.
- Validate date format YYYYMMDD, section-specific line formats.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement anchor generator and collision handling (-b on collision).
- [x] Add dedup normalization for URLs/text.
- [x] Implement validators for Tasks/Resources/Others with soft warnings.
- [x] Unit tests covering edge cases (collision, invalid dates, bad section formats).

## Notes

- Anchor generation and collision handling live in `src/apply.ts`.
- Validators now produce soft warnings via `snapshot.warnings` codes: `bad_date_prefix:<section>`, `missing_anchor:<section>`, `bad_anchor:<section>`, `line_too_long:<section>`.
- Tests: `scripts/test-anchors-validation.mjs`.

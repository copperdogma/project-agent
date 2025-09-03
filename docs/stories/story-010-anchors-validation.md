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
- [ ] Implement validators for Tasks/Resources/Others with soft warnings.
- [ ] Unit tests covering edge cases (collision, invalid dates, bad section formats).

## Notes

- Anchor generation and collision handling live in `src/apply.ts`.
- Validators and warnings are pending; keep acceptance soft vs hard per requirements.

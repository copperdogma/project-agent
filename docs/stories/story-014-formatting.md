# Story: Formatting invariants (dates, line endings)

**Status**: In Progress

---

## Related Requirement

[Vault Conventions; Configuration; Formatting guarantees]

## Alignment with Design

[Design: Tooling & Conventions]

## Acceptance Criteria

- All new lines use YYYYMMDD.
- Preserve existing line endings and trailing newline.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement date formatting helper and enforce in apply/update.
- [x] Detect and preserve EOL per-file via `writeFileSafely`.
- [x] Tests covering mixed EOL files and long lines.

## Notes

- Date stamping and EOL preservation exist; rigorous tests added in `scripts/test-formatting.mjs`.

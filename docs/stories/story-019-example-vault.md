# Story: Example vault fixtures

**Status**: In Progress

---

## Related Requirement

[Configuration and Operational Behavior: Fixtures]

## Alignment with Design

[Design: Configuration]

## Acceptance Criteria

- Provide `example-vault/` with sample projects and anchors.
- Configurable VAULT_ROOT to switch to fixtures.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Create minimal example vault structure.
- [x] Include sample project doc with all sections and anchors.
- [x] Document how to switch via VAULT_ROOT.
- [x] Wire fixtures into tests and CI.

## Notes

- Tests currently use temporary vaults; fixtures will improve reproducibility.
- Fixtures path: `fixtures/example-vault/`.
- Test: `scripts/test-fixtures.mjs`. README updated with usage.

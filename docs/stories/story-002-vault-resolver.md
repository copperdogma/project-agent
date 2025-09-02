# Story: Vault resolver + safe path sandbox

**Status**: In Progress

---

## Related Requirement

[Configuration and Operational Behavior: VAULT_ROOT, sandboxing]

## Alignment with Design

[Design: Configuration; Workflow]

## Acceptance Criteria

- Resolves absolute paths under VAULT_ROOT.
- Denies traversal outside vault.
- Records line ending style per file.
- [ ] User must sign off on functionality before story can be marked complete.
- [ ] Unit tests with malicious paths.

## Tasks

- [x] Implement safePathResolve(root, relativePath).
- [x] Implement readFile/writeFile with lockfile.
- [x] Detect/store line ending style.
- [x] Unit tests with malicious paths.

## Notes

- VAULT_ROOT: '/Users/cam/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/'

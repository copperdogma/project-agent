# Story: Vault resolver + safe path sandbox

**Status**: To Do

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

## Tasks
- [ ] Implement safePathResolve(root, relativePath).
- [ ] Implement readFile/writeFile with lockfile.
- [ ] Detect/store line ending style.
- [ ] Unit tests with malicious paths.

## Notes
- VAULT_ROOT: '/Users/cam/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/'

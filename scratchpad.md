# Scratchpad - Work Phase

**NOTES:

- All To Do items should be added as checklists.
- Do not check something off unless you're confident it's complete.
- Reorganize now and then, putting unfinished tasks at the top and finished ones at the bottom.
  **

      ## Current Story

  Story 002 — Vault resolver + safe path sandbox

## Current Task

Implement vault resolver, locking, and line-ending helpers

## Plan Checklist

- [x] Create `src/vault.ts` with `safePathResolve`
- [x] Add read/write with lockfile
- [x] Add line ending detection and normalization helpers
- [ ] Wire `VAULT_ROOT` configuration validation and docs
- [ ] Add unit tests for traversal attempts and normal cases
- [ ] Integrate into future tools (snapshot, getDocument, applyOps)

## Issues/Blockers

- [ ] Decide on test framework (vitest/jest) or lightweight node script

## Recently Completed

- [x] Story-001b: Minimal MCP transport + tool registration (stdio)
- [x] Story-001: MCP transport + auth shell complete

## Decisions Made

- [x] Use per-file lockfiles with `.lock` suffix
- [x] Preserve detected line endings on write when provided

## Lessons Learned

- [ ] Keep auth checks centralized via preHandler hooks

Keep this file concise (<300 lines): summarize or remove outdated info regularly to prevent overloading the context. Focus on the current phase and immediate next steps.

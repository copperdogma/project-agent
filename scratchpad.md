# Scratchpad - Work Phase

**NOTES:

- All To Do items should be added as checklists.
- Do not check something off unless you're confident it's complete.
- Reorganize now and then, putting unfinished tasks at the top and finished ones at the bottom.
  **

      ## Current Story

  Story 014 — Formatting invariants (dates, line endings)

## Current Task

Add and run integration tests for mixed EOL and long-line updates

## Plan Checklist

- [x] Create test verifying CRLF preservation and YYYYMMDD date prefix
- [x] Verify long-line update behavior
- [x] Run and pass new integration test

## Issues/Blockers

- [ ] Ensure large files handled efficiently (streaming not required yet)

## Recently Completed

- [x] tests: `scripts/test-formatting.mjs` added and passing

## Decisions Made

- [x] Preserve per-file line endings using `readFileSafely` + `writeFileSafely`
- [x] Date prefix enforced via `formatDateYYYYMMDD` in write paths

## Lessons Learned

- [ ] Keep API outputs consistent across tools for client simplicity

Keep this file concise (<300 lines): summarize or remove outdated info regularly to prevent overloading the context. Focus on the current phase and immediate next steps.

# Scratchpad - Work Phase

**NOTES:

- All To Do items should be added as checklists.
- Do not check something off unless you're confident it's complete.
- Reorganize now and then, putting unfinished tasks at the top and finished ones at the bottom.
  **

      ## Current Story

  Story 004 — GetDocument tool

## Current Task

Implement getDocument(full contents + path/size/commit) and tests

## Plan Checklist

- [ ] Create `src/document.ts` with `getDocument(slug)`
- [ ] Reuse vault resolver to locate file by slug
- [ ] Return frontmatter, full content, path, size, current_commit
- [ ] Add tests using temp vault files

## Issues/Blockers

- [ ] Ensure large files handled efficiently (streaming not required yet)

## Recently Completed

- [x] Story 003 — Snapshot tool

## Decisions Made

- [ ] Use same frontmatter parser as snapshot

## Lessons Learned

- [ ] Keep API outputs consistent across tools for client simplicity

Keep this file concise (<300 lines): summarize or remove outdated info regularly to prevent overloading the context. Focus on the current phase and immediate next steps.

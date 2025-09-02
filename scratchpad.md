# Scratchpad - Work Phase

\*\*NOTES:

- All To Do items should be added as checklists.
- Do not check something off unless you're confident it's complete.
- Reorganize now and then, putting unfinished tasks at the top and finished ones at the bottom.
  \*\*

      ## Current Story

  Story 001b — Minimal MCP transport + tool registration (stdio)

## Current Task

Implement stdio MCP server with health/version tools

## Plan Checklist

- [ ] Create `src/mcp.ts` MCP stdio server
- [ ] Register `server.health` and `server.version`
- [ ] Add `start:mcp` script; install SDK
- [ ] Smoke-test local startup

## Issues/Blockers

- [ ] Confirm @modelcontextprotocol/sdk API shape for tool registration

## Recently Completed

- [ ] Story-001: MCP transport + auth shell complete

## Decisions Made

- [ ] Expose only server._ tools in 001b; project._ later

## Lessons Learned

- [ ] Keep auth checks centralized via preHandler hooks

Keep this file concise (<300 lines): summarize or remove outdated info regularly to prevent overloading the context. Focus on the current phase and immediate next steps.

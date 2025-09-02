# Story: Minimal MCP transport + tool registration (stdio)

**Status**: To Do

---

## Related Requirement

[LLM Contract & Tools: server.health, server.version; earliest MCP testing]

## Alignment with Design

[Design: Technology Stack; Workflow]

## Acceptance Criteria

- Stdio MCP server starts and registers `server.health` and `server.version`.
- ChatGPT can install and call these tools (manual test to follow).
- Uses email metadata if provided; safe defaults in dev.
- [ ] User must sign off before marking complete.

## Tasks

- [ ] Add MCP stdio server entry `src/mcp.ts`.
- [ ] Register `server.health` and `server.version` tools.
- [ ] Wire environment/config and logging.
- [ ] Add `start:mcp` npm script and install SDK.
- [ ] Smoke-test process start locally.

## Notes

- Minimal bridge; full project.\* tools wired in later stories.

# Story: Minimal MCP transport + tool registration (stdio)

**Status**: Done

---

## Related Requirement

[LLM Contract & Tools: server.health, server.version; earliest MCP testing]

## Alignment with Design

[Design: Technology Stack; Workflow]

## Acceptance Criteria

- Stdio MCP server starts and registers `server_health` and `server_version`.
- ChatGPT/Claude can install and call these tools (manual test completed).
- Uses email metadata if provided; safe defaults in dev.
- [x] User must sign off before marking complete.

## Tasks

- [x] Add MCP stdio server entry `src/mcp.ts`.
- [x] Register `server_health` and `server_version` tools.
- [x] Wire environment/config and logging.
- [x] Add `start:mcp` npm script and install SDK.
- [x] Smoke-test process start locally (Claude + ngrok).

## Notes

- Minimal bridge; full project.\* tools wired in later stories.

# Story: Health & version tools

**Status**: In Progress

---

## Related Requirement

[Tools: server.health, server.version]

## Alignment with Design

[Design: Technology Stack]

## Acceptance Criteria

- server.health returns status and uptime.
- server.version returns app and schema version.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement uptime tracker.
- [x] Expose both tools via MCP and SSE servers (underscore names).
- [ ] Tests for outputs.

## Notes

- Tools registered as `server_health` and `server_version` in both stdio and SSE servers.
- Version sourced from package.json when available; fallback defaults retained.
- Add unit/integration tests before marking Done.

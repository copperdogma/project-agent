# Story: Implement MCP transport + auth shell

**Status**: Done

---

## Related Requirement

[Security and Tooling sections in `docs/requirements.md`]

## Alignment with Design

[Design: Technology Stack, Tooling & Conventions]

## Acceptance Criteria

- MCP server boots on PORT with transports configured.
- mTLS works (with dev bearer fallback) and email allowlist enforced.
- Health/version endpoints exposed.
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Set up Node+TS project structure and dotenv.
- [x] Implement mTLS server config and cert loading.
- [x] Implement bearer token dev path (env gated).
- [x] Enforce x-user-email allowlist.
- [x] Expose server.health and server.version tools.
- [x] Add basic rate limiting middleware (skeleton).
- [x] Provide dev script to generate self-signed certs; support EMAIL_OVERRIDE.

## Notes

- Use PORT=7777 default; CIDR allowlist for LAN.

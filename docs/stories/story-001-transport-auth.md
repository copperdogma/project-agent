# Story: Implement MCP transport + auth shell

**Status**: To Do

---

## Related Requirement
[Security and Tooling sections in `docs/requirements.md`]

## Alignment with Design
[Design: Technology Stack, Tooling & Conventions]

## Acceptance Criteria
- MCP server boots on PORT with transports configured.
- mTLS works (with dev bearer fallback) and email allowlist enforced.
- Health/version endpoints exposed.
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks
- [ ] Set up Node+TS project structure and dotenv.
- [ ] Implement mTLS server config and cert loading.
- [ ] Implement bearer token dev path (env gated).
- [ ] Enforce x-user-email allowlist.
- [ ] Expose server.health and server.version tools.
- [ ] Add basic rate limiting middleware (skeleton).
 - [ ] Provide dev script to generate self-signed certs; support EMAIL_OVERRIDE.

## Notes
- Use PORT=7777 default; CIDR allowlist for LAN.

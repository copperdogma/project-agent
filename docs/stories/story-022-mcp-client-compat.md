# Story: MCP client compatibility (schemas)

**Status**: Done

---

## Related Requirement

[Client compatibility across MCP implementations]

## Alignment with Design

[Design: Tooling & Conventions — flat schemas, camelCase, small payloads]

## Acceptance Criteria

- All tools use flat, explicit JSON schemas; avoid unions/oneOf.
- Inputs use camelCase; server accepts snake_case silently.
- Claude Desktop and at least one other MCP client can discover and execute all tools without schema errors.
- Document troubleshooting in `AI_TESTING.md` (paste-only input object, no {tool,input} envelope).

## Tasks

- [x] Review all tool schemas; flatten and simplify.
- [x] Add runtime type guards for optional fields (strings or null).
- [x] Update docs and examples to camelCase.
- [x] Validate with Claude Desktop end-to-end.

## Notes

- Consider adding CI checks to ensure schemas remain flat/simple.

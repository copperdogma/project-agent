# Project Architecture

[PROJECT TITLE]

**START CRITICAL NOTES -- DO NOT REMOVE**
- This document details the architectural decisions and setup progress for the project.
- Keep this document formatted according to `architecture-template.md`
- Should we transition to the next phase? `scratchpad.mdc` will explain what script to run to do that.
**END CRITICAL NOTES -- DO NOT REMOVE**

---

## Architectural Decisions
- Preserve existing section order; do not auto-reorder legacy docs.
- Enforce YYYYMMDD date format on new lines; anchors 6–8 base36 with -b on collisions.
- Security: default mTLS on LAN; bearer token only for dev; email allowlist.
- Concurrency: optimistic via expected_commit; support idempotency keys on applyOps.
- Observability: JSONL audit log; git commits with summaries; health/version endpoints.
- Read-only mode for demos/CI; per-email/slug rate limiting.

## Setup Progress
- [ ] Initialize Node.js + TypeScript workspace
- [ ] Add dotenv, simple-git, mTLS libraries
- [ ] Implement MCP transport + tool registration
- [ ] Implement vault resolver with VAULT_ROOT: '/Users/cam/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/'
- [ ] Implement snapshot, getDocument, applyOps, create, list, undo
- [ ] Add server.health and server.version; stub project.search (post-MVP)
- [ ] Add rate limiting and audit logging

## Notes
Components:
- security.ts: auth (mTLS/bearer), email allowlist
- vault.ts: path resolution, file locking
- sections.ts: helpers for suggested order for new docs; preserve existing order otherwise
- snapshot.ts: tails, anchors, ops log, current_commit
- document.ts: full-file fetch
- apply.ts: ops engine, dedup, validations
- git.ts: commit + diff
- registry.ts: projects.yaml
- server.ts: MCP server + tool bindings

Conventions influence from Next.js template best practices where applicable (linting, testing, rate limiting patterns), without adopting Next.js runtime.

### Reference Implementations (for research only)
- Obsidian MCP Plugin (rygwdn): https://github.com/rygwdn/obsidian-mcp-plugin
- UBOS Obsidian MCP Tool Server: https://ubos.tech/mcp/obsidian-mcp-tool-server/
- cyanheads Obsidian MCP Server: https://github.com/cyanheads/obsidian-mcp-server
- jacksteamdev MCP Tools for Obsidian: https://github.com/jacksteamdev/obsidian-mcp-tools

We will derive lessons (e.g., handling frontmatter/tags, search ergonomics, Local REST API nuances) while keeping our deterministic ops, git diffs, and security model.
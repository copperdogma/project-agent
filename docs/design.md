# Project Design

[PROJECT TITLE]

**START CRITICAL NOTES -- DO NOT REMOVE**

- This document outlines the technical design and implementation details (HOW), based on the requirements in `requirements.md`.
- Keep this document formatted according to `design-template.md`
- Should we transition to the next phase? `scratchpad.mdc` will explain what script to run to do that.
  **END CRITICAL NOTES -- DO NOT REMOVE**

---

## Architecture Overview

MCP server that edits Markdown files in the user's Obsidian vault via deterministic ops. Core tools: `project.snapshot`, `project.getDocument`, `project.applyOps`, `project.create`, `project.list`, `project.undo`, `server.health`, `server.version`, and post-MVP `project.previewPlan`/`project.search`. Preserve existing section order; use YYYYMMDD dates; anchors 6–8 base36.

## Technology Stack

- Node.js (LTS), TypeScript
- File I/O + Git (simple-git)
- mTLS or bearer (dev) auth; rate limiting (in-memory initially)
- Env config via dotenv

## Feature Implementations

### Feature: [FEATURE NAME]

**Related Requirement**: [LINK to specific requirement in requirements.md]  
[FILL IN]

## Tooling & Conventions

- Error model: standardized codes `{code,message,details}`
- Optimistic concurrency: `current_commit` + `expected_commit`
- Idempotency: optional `idempotency_key` on applyOps
- Read-only mode: `READONLY=true` blocks writes
- Auditing: JSONL audit under `.project-agent/logs/`
- Rate limiting: per-email and per-slug throttles
- Formatting: preserve original line endings; record in snapshot
- MCP tool naming: use underscores; periods in tool names are not supported by some clients

## External References

- Adopt operational best practices (linting, testing, rate limiting patterns) inspired by Next.js template where applicable, without adopting the web stack. See repo `next-authjs-psql-base-template` for conventions and structure inspiration.

### Related MCP for Obsidian (reference only)

- Obsidian MCP Plugin (rygwdn): vault access via Local REST API [link](https://github.com/rygwdn/obsidian-mcp-plugin)
- UBOS Obsidian MCP Tool Server: read/write/search tools [link](https://ubos.tech/mcp/obsidian-mcp-tool-server/)
- cyanheads Obsidian MCP Server: bridge with frontmatter/tags and cache [link](https://github.com/cyanheads/obsidian-mcp-server)
- jacksteamdev MCP Tools for Obsidian: vault access, semantic search [link](https://github.com/jacksteamdev/obsidian-mcp-tools)

We will not adopt these directly, but will reference them for API shapes and edge cases.

## Workflow (LLM-led)

1. Fetch snapshot (or full document when needed)
2. Plan ops
3. Apply ops with concurrency/idempotency
4. Show diff/commit; optionally undo

## Configuration

- VAULT_ROOT: '/Users/cam/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/'
- PORT=7777, TIMEZONE=America/Edmonton, DATE=YYYYMMDD

## Current Project Structure

```
project-agent/
  src/
    index.ts               # Fastify server with /health and /version
  docs/
    requirements.md
    design.md
    architecture.md
    stories.md
    stories/
  bootstrapping/
    project-types/
    scripts/
  .env.example
  tsconfig.json
  eslint.config.mjs
  .prettierrc
  README.md
```

# Project Agent MCP Server (Obsidian)

A local Model Context Protocol (MCP) server to edit Markdown in your Obsidian vault using deterministic ops with git-backed diffs. Preserves existing section order, uses YYYYMMDD date format, supports optimistic concurrency/idempotency, and includes a read-only mode.

Status: Project Setup phase; minimal server scaffold running (Fastify). Endpoints: `/health`, `/version`. Optional TLS via self-signed certs.

Quick start:
```bash
npm install
cp .env.example .env
npm run build
node dist/index.js
curl -s http://127.0.0.1:7777/health
curl -s http://127.0.0.1:7777/version
```

Dev TLS (optional):
```bash
npm run generate:certs
# then set TLS_CERT_PATH and TLS_KEY_PATH in .env
```

Roadmap (per `/docs/requirements.md`): project.snapshot, project.getDocument, project.applyOps, project.create, project.list, project.undo; deterministic ops + git diff; standardized errors; audit + rate limiting; post-MVP: previewPlan/search.

## MCP tools (planned/available)
- `project.snapshot` (planned): Lightweight summary (frontmatter, toc, per-section tails, anchors index, recent ops, current_commit, date/tz).
- `project.getDocument` (planned): Full Markdown content with frontmatter, path, size, current_commit.
- `project.applyOps` (planned): Deterministic append/move/update/delete by anchor; returns commit, diff, summary. Supports `expected_commit` and optional `idempotency_key`.
- `project.create` (planned): Create new project doc with initial sections and frontmatter; registers in `projects.yaml`.
- `project.list` (planned): List known projects from registry.
- `project.undo` (planned): Revert by commit, return revert commit and diff.
- `server.health` (available): Uptime/status check.
- `server.version` (available): App name/version and schema version.
- `project.previewPlan` (post-MVP): Dry-run validation.
- `project.search` (post-MVP): Find anchors/sections/lines by query.

## Environment
- `PORT` (default `7777`)
- `TIMEZONE` (default `America/Edmonton`)
- `VAULT_ROOT` (absolute path to Obsidian vault)
- `READONLY` (`true|false`; non-GET blocked when true)
- `TLS_CERT_PATH`, `TLS_KEY_PATH` (optional for TLS)
- `EMAIL_ALLOWLIST` (comma-separated emails; future enforcement)
- `EMAIL_OVERRIDE` (dev convenience; future)

## Security
- Localhost by default; LAN access requires TLS (mTLS support planned) and allowlist.
- Email allowlist via `x-user-email` metadata (planned enforcement).
- Read-only mode for demos/CI via `READONLY=true`.

## HTTP endpoints (scaffold)
- `GET /health` → `{ status, uptime_s }`
- `GET /version` → `{ app, version, schema }`

## Scripts
- `npm run dev` – run with ts-node-dev
- `npm run build` – compile TypeScript
- `npm run start` – run compiled server
- `npm run lint` – ESLint
- `npm run format` – Prettier
- `npm run generate:certs` – create dev TLS certs in `certs/`

## License
MIT
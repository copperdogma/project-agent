# Project Agent MCP Server (Obsidian)

A local Model Context Protocol (MCP) server to edit Markdown in your Obsidian vault using deterministic ops with git-backed diffs. Preserves existing section order, uses YYYYMMDD date format, supports optimistic concurrency/idempotency, and includes a read-only mode.

Status: Stable MCP HTTP/SSE server. Core endpoints: `/health`, `/version`, and SSE at `/sse` (alias `/mcp/sse`). Optional TLS and public HTTPS via Tailscale Serve/Funnel.

Quick start (local):

```bash
npm install
cp .env.example .env
npm run build
node dist/index.js
curl -s http://127.0.0.1:7777/health
curl -s http://127.0.0.1:7777/version
```

Deployment and public connector setup:

- See `project-agent-setup.md` for the canonical end-to-end guide (LaunchDaemon as user, Tailscale Serve + Funnel, verification, Claude SSE connector).
- For end-to-end MCP tool validation in Claude, use `AI_TESTING_PROMPT.md`.

Dev TLS (optional):

```bash
npm run generate:certs
# then set TLS_CERT_PATH and TLS_KEY_PATH in .env
```

Roadmap completed per `/docs/requirements.md`: snapshot/get/create/list, write tools (append/update_by_anchor/move_by_anchor/delete_by_anchor), undo; deterministic ops + git diff; standardized errors; preview/search.

## MCP tools (available)

Public tool names (underscores):

- `server_health`, `server_version`
- `project_list`, `project_snapshot`, `project_get_document`, `project_create`
- `project_append`, `project_update_by_anchor`, `project_move_by_anchor`, `project_delete_by_anchor`
- `project_undo`, `project_preview`, `project_search`

## Example Vault Fixtures

For demos and deterministic tests, you can point the server/tools at a bundled fixtures vault:

```
export VAULT_ROOT=$(pwd)/fixtures/example-vault
```

Then run any scripts or start the server; tools will read from the fixtures vault.

## Environment

- `PORT` (default `7777`), `HOST` (default `127.0.0.1`)
- `TIMEZONE` (default `America/Edmonton`)
- `VAULT_ROOT` (absolute path to Obsidian vault)
- `READONLY` (`true|false`; non-GET blocked when true)
- `DEV_BEARER_TOKEN` (optional bearer auth for dev/testing)
- `EMAIL_ALLOWLIST` (comma-separated emails)
- `TLS_CERT_PATH`, `TLS_KEY_PATH`, `TLS_CA_PATH` (optional; mTLS supported)
- `RATE_LIMIT_MAX` (default 100), `RATE_LIMIT_WINDOW` (default `1 minute`)
- Limits: `SNAPSHOT_MAX_BYTES` (default 262144), `APPLY_OPS_MAX_OPS` (default 128), `APPLY_OPS_MAX_LINE_BYTES` (default 16384), `SNAPSHOT_LONG_LINE_WARN_BYTES`

## Security

- Localhost by default; use Tailscale Serve/Funnel or a reverse proxy for external access.
- Bearer token and email allowlist supported; read-only mode via `READONLY=true`.

## HTTP endpoints

- `GET /health` → `{ status, uptime_s }`
- `GET /version` → `{ app, version, schema }`
- `GET /sse` (alias `/mcp/sse`) → establish SSE session
- `POST /sse` (alias `/mcp/sse`) → JSON-RPC messages to the session
- `GET /` → readiness `{ status: "ok" }`
- `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource` → minimal discovery stubs for connector probes

## Scripts

- `npm run dev` – run with ts-node-dev
- `npm run build` – compile TypeScript
- `npm run start` – run compiled server
- `npm run start:mcp` – run MCP stdio server
- `npm run lint` – ESLint
- `npm run format` – Prettier
- `npm run generate:certs` – create dev TLS certs in `certs/`

## License

MIT

## ChatGPT MCP setup and testing

1. Build and start the MCP stdio server

```bash
npm install
npm run build
npm run start:mcp
```

2. Add a Custom MCP in ChatGPT (Desktop app recommended)

- Open ChatGPT → Settings →
- Go to the “Connectors” or “MCP Servers” section → “Add new server”.
- Choose “Local (stdio)” and point it to the command to start this server:
  - Command: `node /Users/cam/Documents/Projects/project-agent/dist/mcp.js`
- Leave auth blank for now. Save.

3. Test tools in a new chat

- Ask: “Call server.health”.
- Ask: “Call server.version”.

Expected output: JSON with `{status, uptime_s}` and `{app, version, schema}` respectively.

Notes

- The stdio MCP server runs until the process is stopped. Use a separate terminal pane or a process manager.
- Full `project.*` tools will be added in subsequent stories; this MVP exposes only `server.health` and `server.version`.

### If you don't see MCP in ChatGPT

Claude Desktop supports MCP today and is a good fallback for local testing.

1. Install Claude Desktop (macOS)
   - Download and install the Claude Desktop app.

2. Add this local MCP server
   - Open Claude → Settings → Tools (MCP) → Add server → Local command
   - Command: `node /Users/cam/Documents/Projects/project-agent/dist/mcp.js`
   - Save and restart Claude if needed.

3. Test in a new Claude chat
   - Ask: “Call server.health” → expect `{status, uptime_s}`
   - Ask: “Call server.version” → expect `{app, version, schema}`

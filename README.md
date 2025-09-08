# Project Agent MCP Server (Obsidian)

A local Model Context Protocol (MCP) server to edit Markdown in your Obsidian vault using deterministic ops with git-backed diffs. Preserves existing section order, uses YYYYMMDD date format, supports optimistic concurrency/idempotency, and includes a read-only mode.

Status: Stable MCP HTTP/SSE server. Core endpoints: `/health`, `/version`, and SSE at `/sse` (alias `/mcp/sse`). Optional TLS and public HTTPS via a reverse proxy or tunnel. Health includes `vault_writable` indicating if the daemon user can write to your vault.

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

- See `project-agent-setup.md` for the canonical end-to-end guide (LaunchDaemon or LaunchAgent, proxy/tunnel options such as Tailscale Serve/Funnel, verification, Claude SSE connector).
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
- `project_create_section` (new) — creates a section heading if missing (inserted as the first section)
- `project_move_document` (new) — move a document between top‑level folders (e.g., from "Project Research" to "Projects"). Optionally rename title and slug.

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
- Git auto-push: `GIT_AUTO_PUSH` (default `true`), `GIT_REMOTE_NAME` (default `origin`) — after write commits the server attempts a best‑effort `git push` of `HEAD` to the current branch. Configure your vault repo with a valid remote and credentials; failures are logged but do not break tool responses.
- Multi-folder roots: `PROJECT_ROOTS` (comma-separated; default `Projects`). The server scans and resolves documents across these top‑level folders (e.g., `Projects,Notes,Project Research`). `project_list` includes `folder` and `path` for each item.
- Limits: `SNAPSHOT_MAX_BYTES` (default 262144), `APPLY_OPS_MAX_OPS` (default 128), `APPLY_OPS_MAX_LINE_BYTES` (default 16384), `SNAPSHOT_LONG_LINE_WARN_BYTES`

## Security

- Localhost by default; use a reverse proxy or tunnel (e.g., Tailscale Serve/Funnel, Cloudflare Tunnel, Caddy/Nginx) for external access.
- Bearer token and email allowlist supported; read-only mode via `READONLY=true`.

Important note about SSE origins and subpaths

- MCP over SSE requires the POST endpoint it advertises (e.g., `/sse` or `/mcp/sse`) to be reachable at the origin root. Subpath proxies (e.g., mapping `/project-agent -> 127.0.0.1:7777`) break message posting; clients will POST to `/<endpoint>` at the origin root, not under the prefix.
- Recommendation: expose each MCP on its own origin. Practical ways to do this:
  - Different local ports (e.g., `127.0.0.1:7777`, `127.0.0.1:7781`) and map each origin 1:1 via your proxy/tunnel to the origin root.
  - Different hostnames (preferred for public HTTPS) that each map their root to a single backend port (e.g., `agent.example.com -> 127.0.0.1:7777`, `twitter.example.com -> 127.0.0.1:7781`).
  - Avoid subpaths for MCP SSE.

## HTTP endpoints

- `GET /health` → `{ status, uptime_s, vault_writable }`
- `GET /version` → `{ app, version, schema }`
- `GET /sse` (alias `/mcp/sse`) → establish SSE session
- `POST /sse` (alias `/mcp/sse`) → JSON-RPC messages to the session
- `GET /` → readiness `{ status: "ok" }`
- `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource` → minimal discovery stubs for connector probes

## Restart service after updates (LaunchDaemon)

```bash
git pull --rebase --autostash && npm run build
sudo launchctl kickstart -k system/com.projectagent.mcp
# Optional diagnostics
sudo launchctl print system/com.projectagent.mcp | sed -n '1,80p'
sudo tail -n 50 /var/log/project-agent.out.log
sudo tail -n 50 /var/log/project-agent.err.log
```

## Restart service after updates (LaunchAgent)

```bash
git pull --rebase --autostash && npm run build
# One-time install/update per-user LaunchAgent (reads .env for VAULT_ROOT, HOST, PORT, PROJECT_ROOTS)
bash scripts/launchagent-install.sh
# Kickstart on demand
launchctl kickstart -k gui/$(id -u)/com.projectagent.mcp.user
# Optional diagnostics
launchctl print gui/$(id -u)/com.projectagent.mcp.user | sed -n '1,80p'
tail -n 50 ~/Library/Logs/com.projectagent.mcp.user.out.log
tail -n 50 ~/Library/Logs/com.projectagent.mcp.user.err.log
```

## Troubleshooting

- READ_ONLY (EACCES) when creating/writing:
  - Fix ownership/permissions on the registry dir: `sudo chown -R $USER:staff "$VAULT_ROOT/.project-agent" && chmod -R u+rwX "$VAULT_ROOT/.project-agent" && sudo chflags -R nouchg "$VAULT_ROOT/.project-agent"`
  - If needed, move the registry aside: `mv "$VAULT_ROOT/.project-agent/projects.yaml" "$VAULT_ROOT/.project-agent/projects.yaml.bak"` and retry.

- .env values with spaces:
  - Quote them: `PROJECT_ROOTS="Projects,Notes,Project Research"`, `RATE_LIMIT_WINDOW="1 minute"`.

- Port 7777 already in use after install:
  - Remove old per-user agent and plist: `launchctl bootout gui/$(id -u)/com.projectagent.mcp && rm ~/Library/LaunchAgents/com.projectagent.mcp.plist`
  - Re-run: `bash scripts/launchagent-install.sh`
  - Use `scripts/status.sh` to see current listener, health, and logs.

## Scripts

- `npm run dev` – run with ts-node-dev
- `npm run build` – compile TypeScript
- `npm run start` – run compiled server
- `npm run start:mcp` – run MCP stdio server
- `npm run lint` – ESLint
- `npm run format` – Prettier
- `npm run generate:certs` – create dev TLS certs in `certs/`
- `scripts/launchagent-install.sh` – install/start per-user LaunchAgent (reads .env; stops system daemon; kills rogue listeners; prints status)
- `scripts/status.sh` – print listener, agent status, health, repo ahead/behind, and recent auto-push logs

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

## Companion MCPs in this repo

This repo includes additional MCP servers that can be exposed publicly via the same Cloudflare Tunnel. Each MCP must serve SSE at the origin root and bind to loopback (127.0.0.1).

- Twitter Scraper MCP
  - Local: `127.0.0.1:7781`
  - Public: `https://mcp-twitter-scraper.copper-dog.com/sse`
  - Install/agent script: `scripts/twitter-install-agent.sh`

- YouTube Transcript MCP
  - Local: `127.0.0.1:7779`
  - Public: `https://mcp-youtube-transcript.copper-dog.com/sse`
  - Repo folder: `youtube-transcript-mcp` (cloned from jkawamoto/mcp-youtube-transcript)
  - Install/agent script: `scripts/youtube-install-agent.sh` (per-user LaunchAgent)
  - Runner: `youtube-transcript-mcp/run_sse.py` (forces FastMCP SSE on HOST/PORT and paths)

Quick checks:

```
bash scripts/check-local.sh 7781 7779
bash scripts/check-public.sh
```

## How to add another MCP (pattern used here)

Use this sequence to add a new MCP or HTTP service and expose it publicly through the existing Cloudflare Tunnel. See AGENTS.md for full details.

1) Pick a local port and bind to loopback
- Choose a free port (e.g., 7783) and ensure the MCP serves SSE at `http://127.0.0.1:PORT/sse`.
- Important: do not rely on subpaths; the advertised SSE endpoint must be at the origin root.

2) Add Cloudflared ingress and DNS
- Edit `~/.cloudflared/config.yml` and add a hostname → port mapping above the fallback 404, e.g.:
  - `hostname: mcp-my-service.copper-dog.com` → `service: http://localhost:7783`
- Route DNS to the tunnel UUID:
  - `cloudflared tunnel route dns <UUID> mcp-my-service.copper-dog.com`
- Apply/restart:
  - `bash scripts/cf-config-apply.sh`

3) Create a LaunchAgent (per-user recommended)
- Preferred for apps requiring user context/venv. Use the pattern in `scripts/youtube-install-agent.sh`:
  - Write `~/Library/LaunchAgents/<label>.plist`
  - Set environment for SSE, e.g. `HOST=127.0.0.1`, `PORT=<port>`, `SSE_ENDPOINT=/sse`
  - For FastMCP servers, prefer `FASTMCP_HOST/PORT/SSE_PATH/MESSAGE_PATH` or a thin wrapper that runs SSE explicitly (see `youtube-transcript-mcp/run_sse.py`).
- Load/reload:
  - `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/<label>.plist`
  - `launchctl kickstart -kp gui/$(id -u)/<label>`

4) Validate locally and publicly
- Local: `curl -N http://127.0.0.1:<port>/sse` (use `-N` to stream)
- Public: `curl -N https://<hostname>/sse`
- Helper scripts: `scripts/check-local.sh`, `scripts/check-public.sh`

Tips captured from integration:
- Single-level subdomains only (Universal SSL covers `*.copper-dog.com`).
- Each MCP on its own origin; no path multiplexing for SSE.
- Some FastMCP-based servers default to stdio; add a small `run_sse.py` that uses `mcp.server.sse.SseServerTransport` and the package’s underlying server to force SSE on a fixed port.
- Avoid running installer scripts with `sudo`; per-user LaunchAgents must run as the user to create venvs and manage logs.

## Other Public Services via Cloudflare Tunnel

Non‑MCP services on this Mac mini are also exposed through the same Cloudflare Tunnel. These map 1:1 from single‑level subdomains to localhost ports:

- sabnzbd.copper-dog.com → `http://127.0.0.1:9999`
- plex.copper-dog.com → `http://127.0.0.1:32400`
- sonarr.copper-dog.com → `http://127.0.0.1:8989`
- radarr.copper-dog.com → `http://127.0.0.1:7878`
- homebridge.copper-dog.com → `http://127.0.0.1:8581`

To add/modify mappings:
- Edit `cloudflared/config.copper-dog.yml` and add hostname → service rules above the final `http_status:404`.
- Route DNS for each hostname to the tunnel UUID:
  - `cloudflared tunnel route dns 8611370f-7aa1-42a1-8647-8a64c12bc2d2 <hostname>`
- Apply and restart Cloudflared:
  - `bash scripts/cf-config-apply.sh`

Quick verify (public):
```
curl -sSI https://sabnzbd.copper-dog.com | head -n 5
curl -sSI https://plex.copper-dog.com | head -n 5
curl -sSI https://sonarr.copper-dog.com | head -n 5
curl -sSI https://radarr.copper-dog.com | head -n 5
curl -sSI https://homebridge.copper-dog.com | head -n 5
```

# Project Agent (MCP) on macOS via Tailnet — LaunchDaemon Setup

This guide provisions the Project Agent Node/Fastify server as a system LaunchDaemon on macOS. By default it binds to a port (e.g., `127.0.0.1:7777`) and is intended to be exposed as its own origin (no subpath) via a proxy/tunnel. It also includes an optional LaunchDaemon that auto pull/pushes your Obsidian vault git repo every 3 minutes.

Works non-interactively, idempotently, and persists across reboots.

## Assumptions
- App path: `/Users/occam/MCPs/project-agent`
- Built entrypoint: `/Users/occam/MCPs/project-agent/dist/index.js`
- Vault path (git repo): `/Users/occam/Documents/obsidian`
- Main daemon label/plist: `com.projectagent.mcp` → `/Library/LaunchDaemons/com.projectagent.mcp.plist`
- Git push daemon label/plist: `com.projectagent.gitpush` → `/Library/LaunchDaemons/com.projectagent.gitpush.plist`
- Service env: `HOST=127.0.0.1`, `PORT=7777` (bind loopback when fronted by a proxy)
- Unauthenticated endpoints for verification: `GET /version`, `GET /health` (also reports `vault_writable`)
- Authentication for other routes uses `DEV_BEARER_TOKEN` and `x-user-email` in `EMAIL_ALLOWLIST`

Note on macOS privacy (TCC): if your vault is under `~/Documents`, a root LaunchDaemon may get EPERM. Run the daemon as the target user (e.g., `occam`) to ensure access.

## Networking and Origins (SSE requirement)

MCP over SSE must be presented at the origin root. Do not place this service under a path prefix (e.g., `/project-agent`). If you proxy under a subpath, the SSE client will attempt to POST to the root (e.g., `https://host/messages?...`) and tool listing/calls will fail.

Recommended pattern when running multiple MCP servers:

- Run each MCP on its own local port (`127.0.0.1:<port>`).
- Expose each as its own origin (distinct hostname) that maps the origin root to exactly one backend port.
- Avoid subpath mappings for MCP.

Examples for exposing separate origins are provided below for Tailscale (tailnet only) and Cloudflare Tunnel (public). If you prefer to manage your own domain and TLS, see the Caddy/Nginx section.

## Tailscale (Tailnet + Optional Public HTTPS)
- Install the Tailscale CLI and log in so the machine has a tailnet IP (100.64.0.0/10):
  ```bash
  brew install tailscale
  sudo tailscale up         # follow login flow in browser
  tailscale status | cat
  ```
- If using an auth key for unattended login: `sudo tailscale up --authkey "$TS_AUTHKEY"`.
- Do NOT symlink `/Applications/Tailscale.app/...` to `tailscale`; use the Homebrew CLI above to avoid bundle errors.

## One‑time Bootstrap (copy/paste)
Run these commands in Terminal. They tolerate repeated runs and will fix most issues automatically.

```bash
set -euo pipefail

# --- Paths and labels ---
APP_DIR="/Users/occam/MCPs/project-agent"
VAULT_DIR="/Users/occam/Documents/obsidian"
MCP_PLIST="/Library/LaunchDaemons/com.projectagent.mcp.plist"
GIT_PLIST="/Library/LaunchDaemons/com.projectagent.gitpush.plist"
LOG_OUT="/var/log/project-agent.out.log"
LOG_ERR="/var/log/project-agent.err.log"
PUSH_LOG_OUT="/var/log/project-agent.push.out.log"
PUSH_LOG_ERR="/var/log/project-agent.push.err.log"

# --- Ensure Homebrew + Node (if missing) ---
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
NODE_PATH="$(/usr/bin/which node || true)"
if [ -z "${NODE_PATH}" ]; then
  if [ ! -x /opt/homebrew/bin/brew ] && [ ! -x /usr/local/bin/brew ]; then
    echo "Installing Homebrew..."
    NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || true
    eval "$([ -x /opt/homebrew/bin/brew ] && /opt/homebrew/bin/brew shellenv || /usr/local/bin/brew shellenv)"
  fi
  echo "Installing Node..."
  brew install node || true
  NODE_PATH="$(/usr/bin/which node || true)"; [ -z "$NODE_PATH" ] && NODE_PATH="/opt/homebrew/bin/node"; 
fi
[ -x "$NODE_PATH" ] || NODE_PATH="/usr/local/bin/node"
echo "Using node: $NODE_PATH"

# --- Fetch or update the app ---
mkdir -p "$(dirname "$APP_DIR")"
if [ ! -d "$APP_DIR/.git" ]; then
  echo "Cloning project-agent..."
  git clone https://github.com/copperdogma/project-agent.git "$APP_DIR"
else
  echo "Updating project-agent..."
  git -C "$APP_DIR" pull --rebase --autostash || true
fi

# --- Build ---
(cd "$APP_DIR" && npm ci && npm run build)

# --- Ensure the server binds to HOST env ---
# Current code respects HOST; verify compiled output contains host from env (not hardcoded 127.0.0.1)
if ! grep -q "process.env.HOST" "$APP_DIR/dist/index.js"; then
  echo "Patching dist to honor HOST..."
  # Minimal inline patch (safe if not present)
  perl -0777 -pe 's/listen\(\{\s*port,\s*host: \"127\.0\.0\.1\"\s*\}\)/do{my $h="process.env.HOST || \"127.0.0.1\""; "listen({ port, host: $h })"}/se' -i "$APP_DIR/dist/index.js" || true
fi

# --- Create main LaunchDaemon plist ---
cat > /tmp/com.projectagent.mcp.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.projectagent.mcp</string>
  <key>UserName</key><string>occam</string>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${APP_DIR}/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>VAULT_ROOT</key><string>${VAULT_DIR}</string>
    <key>PORT</key><string>7777</string>
    <!-- Bind loopback when fronted by Serve/Funnel/Proxy -->
    <key>HOST</key><string>127.0.0.1</string>
    <key>READONLY</key><string>false</string>
    <key>DEV_BEARER_TOKEN</key><string>set-a-strong-token</string>
    <key>EMAIL_ALLOWLIST</key><string>you@example.com</string>
    <key>TIMEZONE</key><string>America/Edmonton</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>${LOG_OUT}</string>
  <key>StandardErrorPath</key><string>${LOG_ERR}</string>
</dict></plist>
PLIST
sudo mv /tmp/com.projectagent.mcp.plist "$MCP_PLIST"
sudo chown root:wheel "$MCP_PLIST"
sudo chmod 644 "$MCP_PLIST"
/usr/bin/plutil -lint "$MCP_PLIST"

# --- Prepare logs ---
sudo touch "$LOG_OUT" "$LOG_ERR"
sudo chmod 664 "$LOG_OUT" "$LOG_ERR"
sudo chown root:wheel "$LOG_OUT" "$LOG_ERR"

# --- Load (enable) and start the daemon ---
sudo launchctl unload "$MCP_PLIST" 2>/dev/null || true
sudo launchctl load -w "$MCP_PLIST"
sudo launchctl kickstart -k system/com.projectagent.mcp || true
sudo launchctl print system/com.projectagent.mcp | sed -n '1,150p'

# --- Optional: legacy auto pull/push daemon every 3 minutes ---
# Note: The Project Agent now attempts a best‑effort git push after write commits
# using the repository's current branch and `GIT_REMOTE_NAME` (default `origin`).
# This helper remains for environments that prefer timed push or external sync.
cat > /tmp/obsidian-auto-push.sh <<'SH'
#!/usr/bin/env bash
set -e
VAULT="/Users/occam/Documents/obsidian"
[ -d "$VAULT/.git" ] || exit 0
/usr/bin/git -C "$VAULT" pull --rebase --autostash origin main || true
/usr/bin/git -C "$VAULT" push -q origin HEAD:main || true
SH
sudo mv /tmp/obsidian-auto-push.sh /usr/local/bin/obsidian-auto-push.sh
sudo chmod +x /usr/local/bin/obsidian-auto-push.sh

cat > /tmp/com.projectagent.gitpush.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.projectagent.gitpush</string>
  <key>WorkingDirectory</key><string>${VAULT_DIR}</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/obsidian-auto-push.sh</string></array>
  <key>StartInterval</key><integer>180</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${PUSH_LOG_OUT}</string>
  <key>StandardErrorPath</key><string>${PUSH_LOG_ERR}</string>
</dict></plist>
PLIST
sudo mv /tmp/com.projectagent.gitpush.plist "$GIT_PLIST"
sudo chown root:wheel "$GIT_PLIST"
sudo chmod 644 "$GIT_PLIST"
/usr/bin/plutil -lint "$GIT_PLIST"
sudo touch "$PUSH_LOG_OUT" "$PUSH_LOG_ERR"
sudo chmod 664 "$PUSH_LOG_OUT" "$PUSH_LOG_ERR"
sudo chown root:wheel "$PUSH_LOG_OUT" "$PUSH_LOG_ERR"
sudo launchctl unload "$GIT_PLIST" 2>/dev/null || true
sudo launchctl load -w "$GIT_PLIST"
sudo launchctl print system/com.projectagent.gitpush | sed -n '1,80p' || true

# --- Verify listening and endpoints ---
(command -v lsof >/dev/null 2>&1 && lsof -iTCP:7777 -sTCP:LISTEN -nP) || (netstat -an 2>/dev/null | grep '\.7777 ' || true)
curl -s http://127.0.0.1:7777/version | cat; echo
curl -s http://127.0.0.1:7777/health | cat; echo

# Tailnet HTTPS (Serve) status (if configured on this node)
if command -v tailscale >/dev/null 2>&1; then
tailscale serve status || true
fi
```

### Optional: second MCP instance (separate origin/port)
Use this template to run another MCP server (this app or a different repo) on a different local port and LaunchDaemon label. Adjust `APP_DIR2`, `LABEL2`, and `PORT2`.

```bash
set -euo pipefail

APP_DIR2="/Users/occam/MCPs/twitter-scraper"   # change to the other tool's path
LABEL2="com.twitter.scraper"                   # unique label for launchd
PORT2="7781"                                   # unique port for this tool
NODE_PATH="$(/usr/bin/which node || true)"; [ -x "$NODE_PATH" ] || NODE_PATH="/opt/homebrew/bin/node"

# Build if this is a Node/TypeScript app
if [ -d "$APP_DIR2" ]; then
  (cd "$APP_DIR2" && [ -f package.json ] && npm ci && npm run build) || true
fi

cat > /tmp/${LABEL2}.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL2}</string>
  <key>UserName</key><string>occam</string>
  <key>WorkingDirectory</key><string>${APP_DIR2}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${APP_DIR2}/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>HOST</key><string>127.0.0.1</string>
    <key>PORT</key><string>${PORT2}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/var/log/${LABEL2}.out.log</string>
  <key>StandardErrorPath</key><string>/var/log/${LABEL2}.err.log</string>
</dict></plist>
PLIST

sudo mv /tmp/${LABEL2}.plist "/Library/LaunchDaemons/${LABEL2}.plist"
sudo chown root:wheel "/Library/LaunchDaemons/${LABEL2}.plist"
sudo chmod 644 "/Library/LaunchDaemons/${LABEL2}.plist"
/usr/bin/plutil -lint "/Library/LaunchDaemons/${LABEL2}.plist"
sudo touch "/var/log/${LABEL2}.out.log" "/var/log/${LABEL2}.err.log"
sudo chmod 664 "/var/log/${LABEL2}.out.log" "/var/log/${LABEL2}.err.log"
sudo chown root:wheel "/var/log/${LABEL2}.out.log" "/var/log/${LABEL2}.err.log"
sudo launchctl unload "/Library/LaunchDaemons/${LABEL2}.plist" 2>/dev/null || true
sudo launchctl load -w "/Library/LaunchDaemons/${LABEL2}.plist"
sudo launchctl print "system/${LABEL2}" | sed -n '1,80p' || true
```

## Remote Reachability
Tailnet HTTPS via Serve (tailnet-only):
```bash
curl https://<device-name>.<tailnet>.ts.net/version
curl https://<device-name>.<tailnet>.ts.net/health
```

Direct HTTP (if you bind `HOST=0.0.0.0` for tailnet/LAN):
```bash
curl http://<TAILNET_IP>:7777/version
curl http://<TAILNET_IP>:7777/health
# For authenticated routes:
curl -H "Authorization: Bearer set-a-strong-token" -H "x-user-email: you@example.com" \
  http://<TAILNET_IP>:7777/some/protected
```

## HTTPS Options
- Tailnet-only HTTPS (no DNS/ports): use Tailscale Serve.
- Public HTTPS without port-forwarding: use Tailscale Funnel or Cloudflare Tunnel.
- Public HTTPS with your own domain/server: use a reverse proxy (Caddy/Nginx) with Let's Encrypt.

### Option A — Tailnet HTTPS via Tailscale Serve (tailnet access only)
Expose the app at an HTTPS URL on your tailnet (MagicDNS), terminated by Tailscale.

Requirements: Tailscale app running and logged in. Newer CLI uses the simplified `serve` syntax shown below.

Commands (first-time enable requires a one-time admin approval):
```bash
# 0) Ensure the app is up locally
curl -s http://127.0.0.1:7777/health | cat

# 1) Start Serve in the background (prints an approval URL and waits)
tailscale serve --bg 127.0.0.1:7777
# Open the printed URL and enable only "HTTPS" (do not enable Funnel for tailnet-only access).

# 2) After approval, finalize non-interactively (flags before target)
tailscale serve --yes --bg 127.0.0.1:7777

# 3) Verify configuration and copy the FQDN
tailscale serve status
```

Access (from any device on your tailnet):
- Use the full MagicDNS FQDN shown by `serve status`, e.g.:
- https://<device-name>.<tailnet>.ts.net/

Notes:
- Keep this service at the origin root; do not configure subpaths for MCP.
- For extra hardening, bind loopback only: set `HOST=127.0.0.1` in the plist and reload with `launchctl`.
- The `--yes` and `--bg` flags must precede the target on this CLI.
- If you see “Serve is not enabled on your tailnet…”, open the printed approval link, enable only HTTPS, then rerun the command.

### Option B — Public HTTPS via Tailscale Funnel (recommended for Claude)
Expose the same Serve site publicly with valid TLS under `*.ts.net` (no ports/NAT).

Requirements:
- Tailscale CLI installed and device logged in (see above)
- Tailnet policy grants the `funnel` attribute (Access Controls → Policy file):
  ```json
  "nodeAttrs": [ { "target": ["autogroup:members"], "attr": ["funnel"] } ]
  ```

Commands:
```bash
# 1) Start Serve (idempotent); approve HTTPS if prompted
tailscale serve --bg 127.0.0.1:7777
tailscale serve --yes --bg 127.0.0.1:7777

# 2) Enable Funnel (public)
tailscale funnel --bg 127.0.0.1:7777

# 3) Verify
tailscale funnel status | cat
# Example success:
# Available on the internet:
# https://the-octagon.tailXXXX.ts.net/
# |-- proxy http://127.0.0.1:7777
```

Public access test (from non-tailnet, e.g., LTE):
```bash
curl -sS https://<device-name>.<tailnet>.ts.net/version | cat
```

Notes:
- A minor `client version != tailscaled version` warning is safe to ignore.
- Keep your app’s auth in place since this is public.
- Important: Funnel exposes HTTPS on the device’s `*.ts.net` hostname at port 443. It does not provide multiple public HTTPS origins on distinct external ports. If you need multiple MCP servers publicly, use distinct hostnames via a reverse proxy or Cloudflare Tunnel (below), and map each hostname’s root to a single backend port.

### Option C — Public HTTPS via Cloudflare Tunnel (multiple hostnames, no open ports)
This maps a custom domain to the local service over an outbound tunnel.

Requirements: A Cloudflare account with your domain on Cloudflare DNS.

Commands (once per machine):
```bash
brew install cloudflared
cloudflared tunnel login                       # authenticate in browser
cloudflared tunnel create project-agent        # creates a tunnel and credentials

# Map hostnames to this tunnel (replace with your domain)
cloudflared tunnel route dns project-agent agent.example.com
cloudflared tunnel route dns project-agent twitter.example.com

# Create config (~/.cloudflared/config.yml)
cat > ~/.cloudflared/config.yml <<'YAML'
tunnel: project-agent
credentials-file: ~/.cloudflared/$(ls ~/.cloudflared | grep json | head -n1)
ingress:
  - hostname: agent.example.com
    service: http://127.0.0.1:7777
  - hostname: twitter.example.com
    service: http://127.0.0.1:7781
  - service: http_status:404
YAML

# Run the tunnel (or use `brew services start cloudflared`)
cloudflared tunnel run project-agent
```

### Option D — Reverse Proxy with Automatic TLS (Caddy or Nginx + Let's Encrypt)
Use if you control DNS and can forward ports 80/443 to this Mac.

- Caddy (simplest):
  ```bash
  brew install caddy
  sudo bash -c 'cat > /usr/local/etc/Caddyfile <<EOF
  agent.example.com {
      reverse_proxy 127.0.0.1:7777
  }
  twitter.example.com {
      reverse_proxy 127.0.0.1:7781
  }
  EOF'
  sudo caddy run --config /usr/local/etc/Caddyfile  # or: brew services start caddy
  ```

- Nginx + Certbot (alternative):
  ```bash
  brew install nginx certbot
  # Configure nginx server block for agent.example.com -> 127.0.0.1:7777
  # Then request cert and auto-configure:
  sudo certbot --nginx -d agent.example.com
  ```

Hardening tip:
- If using Serve/Funnel/Cloudflare, set `HOST=127.0.0.1` (already configured above) so the app is only reachable via the proxy.
- MCP servers must be exposed at the origin root. Use separate hostnames (preferred) or separate tailnet HTTP origins, not subpaths.

## Connect Claude Desktop (SSE)
1) Ensure public HTTPS works (Funnel or another reverse proxy):
   - `curl -isk https://<device>.<tailnet>.ts.net/version`
   - `curl -iskN https://<device>.<tailnet>.ts.net/sse` (you should see an initial `event: endpoint`)
2) In Claude Desktop → Settings → Developer → MCP Servers → Add custom connector:
   - Name: Project Agent
   - URL: `https://<device>.<tailnet>.ts.net/sse` (tailnet Serve) or `https://agent.example.com/sse` (Cloudflare/Caddy hostname)
   - Leave OAuth fields empty
3) Multiple tools (example hostnames):
   - Project Agent: `https://agent.example.com/sse`
   - Twitter Scraper: `https://twitter.example.com/sse`
   Ensure each hostname maps its origin root to a single backend port.

4) Click Add, then Connect. On the Mac mini, watch logs:
   - `sudo tail -f /var/log/project-agent.out.log`
   - You should see: GET `/sse` ("sse session registered"), followed by POST `/sse` ("forwarded to transport").

## Restart service after updates

When you pull new code or rebuild, restart the LaunchDaemon:

```bash
cd /Users/occam/MCPs/project-agent
git pull --rebase --autostash && npm run build
sudo launchctl kickstart -k system/com.projectagent.mcp
```

Optional diagnostics:

```bash
sudo launchctl print system/com.projectagent.mcp | sed -n '1,120p'
sudo tail -n 100 /var/log/project-agent.out.log
sudo tail -n 100 /var/log/project-agent.err.log
```

## Troubleshooting
- EX_CONFIG (78) after `load`:
  - Likely causes: invalid plist, `node` not found, or specifying `UserName` for a system LaunchDaemon. Solution: remove `UserName` to run as root, ensure absolute `node` path in ProgramArguments, and include `PATH` in `EnvironmentVariables`.
  - Validate plist: `plutil -lint /Library/LaunchDaemons/com.projectagent.mcp.plist`.
  - Check logs: `sudo tail -n 200 /var/log/project-agent.err.log` and `...out.log`.
  - Launchd status: `sudo launchctl print system/com.projectagent.mcp | sed -n '1,200p'`.
  - Launchd events: `log show --last 15m --predicate 'process == "launchd" && eventMessage CONTAINS "com.projectagent.mcp"'`.
- Service not listening on 0.0.0.0:
  - For LAN/tailnet HTTP access, set `HOST=0.0.0.0` in the plist and reload.
  - For Serve/Funnel/Cloudflare (recommended), set `HOST=127.0.0.1` (as configured above) and rely on the proxy.
  - The server reads `HOST` and uses `.listen({ port, host })`. Rebuild if you changed sources.
- Manual foreground test (to surface runtime errors):
  ```bash
  sudo -H env \
    PATH="/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin" \
    VAULT_ROOT="/Users/occam/Documents/obsidian" \
    HOST="0.0.0.0" PORT="7777" READONLY="false" \
    DEV_BEARER_TOKEN="set-a-strong-token" \
    "$NODE_PATH" \
    "/Users/occam/MCPs/project-agent/dist/index.js"
  ```

## Notes
- LaunchDaemons run as root; that’s expected here and avoids certain EX_CONFIG issues. Logs are placed under `/var/log/` with `root:wheel` ownership and mode `664`.
- The optional git push daemon is also a system LaunchDaemon and will run every 180 seconds if the vault is a git repo.
- Persistence across reboots is handled by `launchctl load -w`.

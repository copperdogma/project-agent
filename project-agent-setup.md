# Project Agent (MCP) on macOS via Tailnet — LaunchDaemon Setup

This guide provisions the Project Agent Node/Fastify server as a system LaunchDaemon on macOS. By default it binds to `0.0.0.0:7777` for direct LAN/tailnet HTTP access; you can optionally enable Tailnet HTTPS via Tailscale Serve. It also includes an optional LaunchDaemon that auto pull/pushes your Obsidian vault git repo every 3 minutes.

Works non-interactively, idempotently, and persists across reboots.

## Assumptions
- App path: `/Users/occam/MCPs/project-agent`
- Built entrypoint: `/Users/occam/MCPs/project-agent/dist/index.js`
- Vault path (git repo): `/Users/occam/Documents/obsidian`
- Main daemon label/plist: `com.projectagent.mcp` → `/Library/LaunchDaemons/com.projectagent.mcp.plist`
- Git push daemon label/plist: `com.projectagent.gitpush` → `/Library/LaunchDaemons/com.projectagent.gitpush.plist`
- Service env: `HOST=0.0.0.0`, `PORT=7777` (use `127.0.0.1` with Serve-only)
- Unauthenticated endpoints for verification: `GET /version`, `GET /health`
- Authentication for other routes uses `DEV_BEARER_TOKEN` and `x-user-email` in `EMAIL_ALLOWLIST`

## Optional: Tailscale
- Install and log in to Tailscale so the machine has a tailnet IP (100.64.0.0/10).
- If using an auth key for unattended login, set `TS_AUTHKEY` and run: `sudo tailscale up --authkey "$TS_AUTHKEY"`.

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
    <key>HOST</key><string>0.0.0.0</string>
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

# --- Optional: auto pull/push daemon every 3 minutes ---
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

## Remote Reachability (from another tailnet device)
Tailnet HTTPS via Serve (optional):
```bash
curl https://<device-name>.<tailnet>.ts.net/version
curl https://<device-name>.<tailnet>.ts.net/health
```

Direct HTTP (default HOST=0.0.0.0):
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

### Option A — Tailnet HTTPS via Tailscale Serve (recommended if you only need tailnet access)
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
- Default in this guide is direct HTTP on `0.0.0.0:7777`. Serve works with that, but for extra hardening, you can switch to loopback-only: set `HOST=127.0.0.1` in the plist and reload with `launchctl`.
- The `--yes` and `--bg` flags must precede the target on this CLI.
- If you see “Serve is not enabled on your tailnet…”, open the printed approval link, enable only HTTPS, then rerun the command.

### Option B — Public HTTPS via Tailscale Funnel
This makes the same `tailscale serve` site reachable from the public Internet with a valid TLS cert, no firewall/NAT changes.

Requirements: Tailscale Funnel enabled for your tailnet (admin console). Complete Option A first.

Commands:
```bash
# Turn on Funnel for the served site
tailscale funnel on

# Check status
tailscale funnel status
```

Access:
- Public HTTPS URL will match your device/tailnet name under `ts.net`.

Notes:
- Keep auth in your app (bearer token + allowlist) since Funnel makes it public.

### Option C — Public HTTPS via Cloudflare Tunnel (no open ports)
This maps a custom domain to the local service over an outbound tunnel.

Requirements: A Cloudflare account with your domain on Cloudflare DNS.

Commands (once per machine):
```bash
brew install cloudflared
cloudflared tunnel login                       # authenticate in browser
cloudflared tunnel create project-agent        # creates a tunnel and credentials

# Map a hostname to this tunnel (replace with your domain)
cloudflared tunnel route dns project-agent agent.example.com

# Create config (~/.cloudflared/config.yml)
cat > ~/.cloudflared/config.yml <<'YAML'
tunnel: project-agent
credentials-file: ~/.cloudflared/$(ls ~/.cloudflared | grep json | head -n1)
ingress:
  - hostname: agent.example.com
    service: http://127.0.0.1:7777
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
- If using a local reverse proxy (Caddy/Nginx/Cloudflare Tunnel), set `HOST=127.0.0.1` in `/Library/LaunchDaemons/com.projectagent.mcp.plist` so the app is only reachable via the proxy.

## Troubleshooting
- EX_CONFIG (78) after `load`:
  - Likely causes: invalid plist, `node` not found, or specifying `UserName` for a system LaunchDaemon. Solution: remove `UserName` to run as root, ensure absolute `node` path in ProgramArguments, and include `PATH` in `EnvironmentVariables`.
  - Validate plist: `plutil -lint /Library/LaunchDaemons/com.projectagent.mcp.plist`.
  - Check logs: `sudo tail -n 200 /var/log/project-agent.err.log` and `...out.log`.
  - Launchd status: `sudo launchctl print system/com.projectagent.mcp | sed -n '1,200p'`.
  - Launchd events: `log show --last 15m --predicate 'process == "launchd" && eventMessage CONTAINS "com.projectagent.mcp"'`.
- Service not listening on 0.0.0.0:
  - For LAN/tailnet HTTP (default): keep `HOST=0.0.0.0` in the plist.
  - For Tailnet HTTPS via Serve only: set `HOST=127.0.0.1` and use `tailscale serve` (see section above).
  - The codebase (src/index.ts) reads `HOST` and passes it to Fastify `.listen({ port, host })`. Rebuild with `npm run build` if you updated sources.
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

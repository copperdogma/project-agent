# Project Agent over VPN (macOS / Tailnet)

This doc is for your Mac mini deployment. It binds the server to the VPN-accessible interface (HOST=0.0.0.0) and skips `tailscale serve`.

Assumptions
- VAULT_ROOT: /Users/occam/Documents/obsidian
- App path: /Users/occam/MCPs/project-agent
- Auth to GitHub for the obsidian repo is already set up (SSH deploy key or gh login)

## 1) Install and build
```bash
mkdir -p /Users/occam/MCPs
git clone https://github.com/copperdogma/project-agent.git /Users/occam/MCPs/project-agent
cd /Users/occam/MCPs/project-agent
npm ci && npm run build
```

## 2) LaunchDaemon — Project Agent (always-on at boot)
Binds to 0.0.0.0 so it’s reachable on the VPN IP without extra forwarders.

```bash
# Determine absolute node path (Apple Silicon Homebrew default shown)
NODE_PATH="$(/usr/bin/which node || true)"; if [ -z "$NODE_PATH" ]; then NODE_PATH="/opt/homebrew/bin/node"; fi; echo "Using node at: $NODE_PATH"

sudo tee /Library/LaunchDaemons/com.projectagent.mcp.plist >/dev/null <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.projectagent.mcp</string>
  <key>WorkingDirectory</key><string>/Users/occam/MCPs/project-agent</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>/Users/occam/MCPs/project-agent/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>VAULT_ROOT</key><string>/Users/occam/Documents/obsidian</string>
    <key>TIMEZONE</key><string>America/Edmonton</string>
    <key>EMAIL_ALLOWLIST</key><string>you@example.com</string>
    <key>DEV_BEARER_TOKEN</key><string>set-a-strong-token</string>
    <key>PORT</key><string>7777</string>
    <key>HOST</key><string>0.0.0.0</string>
    <key>READONLY</key><string>false</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>/var/log/project-agent.out.log</string>
  <key>StandardErrorPath</key><string>/var/log/project-agent.err.log</string>
</dict></plist>
PLIST

# Ensure log files exist and are writable by launchd
sudo touch /var/log/project-agent.out.log /var/log/project-agent.err.log
sudo chmod 664 /var/log/project-agent.out.log /var/log/project-agent.err.log
sudo chown root:wheel /var/log/project-agent.out.log /var/log/project-agent.err.log

sudo launchctl unload /Library/LaunchDaemons/com.projectagent.mcp.plist 2>/dev/null || true
sudo launchctl load -w /Library/LaunchDaemons/com.projectagent.mcp.plist
sudo launchctl print system/com.projectagent.mcp | sed -n '1,120p'
```

Note: LaunchDaemons run as root by default. Omitting `UserName` avoids certain EX_CONFIG failures on some systems.

## 3) Auto pull/push for the vault (every 3 min)
```bash
sudo tee /usr/local/bin/obsidian-auto-push.sh >/dev/null <<'SH'
#!/usr/bin/env bash
set -e
VAULT="/Users/occam/Documents/obsidian"
# Ensure repo exists before attempting pulls/pushes
if [ ! -d "$VAULT/.git" ]; then
  echo "Vault is not a git repo: $VAULT" >&2
  exit 0
fi
/usr/bin/git -C "$VAULT" pull --rebase --autostash origin main || true
/usr/bin/git -C "$VAULT" push -q origin HEAD:main || true
SH
sudo chmod +x /usr/local/bin/obsidian-auto-push.sh

sudo tee /Library/LaunchDaemons/com.projectagent.gitpush.plist >/dev/null <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.projectagent.gitpush</string>
  <key>WorkingDirectory</key><string>/Users/occam/Documents/obsidian</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/obsidian-auto-push.sh</string></array>
  <key>StartInterval</key><integer>180</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/var/log/project-agent.push.out.log</string>
  <key>StandardErrorPath</key><string>/var/log/project-agent.push.err.log</string>
</dict></plist>
PLIST
sudo touch /var/log/project-agent.push.out.log /var/log/project-agent.push.err.log
sudo chmod 664 /var/log/project-agent.push.out.log /var/log/project-agent.push.err.log
sudo chown root:wheel /var/log/project-agent.push.out.log /var/log/project-agent.push.err.log
sudo launchctl unload /Library/LaunchDaemons/com.projectagent.gitpush.plist 2>/dev/null || true
sudo launchctl load -w /Library/LaunchDaemons/com.projectagent.gitpush.plist
sudo launchctl print system/com.projectagent.gitpush | sed -n '1,120p'
```

## 4) Smoke test (from another VPN device)
```bash
curl http://<mac-mini-vpn-ip>:7777/version
curl -H "Authorization: Bearer set-a-strong-token" -H "x-user-email: you@example.com" \
  http://<mac-mini-vpn-ip>:7777/health
```

## Troubleshooting
- EX_CONFIG (exit code 78) right after load usually means the job failed to exec the command (e.g., `node` not found), the plist is malformed, or an incompatible `UserName` was specified.
- Fixes:
  - Use an absolute Node path in `ProgramArguments` (see step 2). On Apple Silicon Homebrew, it’s typically `/opt/homebrew/bin/node`.
  - Add a `PATH` in `EnvironmentVariables` so subprocesses like `git` resolve.
  - Ensure log files exist under `/var/log/` and are writable by launchd (touch/chmod above).
  - Remove `UserName` for system LaunchDaemons to run as root, which avoids some EX_CONFIG cases.
  - Validate the plist XML: `plutil -lint /Library/LaunchDaemons/com.projectagent.mcp.plist`.
  - Run the service manually as the target user to surface runtime errors:
    ```bash
    sudo -H env \
      VAULT_ROOT=/Users/occam/Documents/obsidian \
      DEV_BEARER_TOKEN=set-a-strong-token \
      EMAIL_ALLOWLIST=you@example.com \
      HOST=0.0.0.0 PORT=7777 READONLY=false \
      /opt/homebrew/bin/node /Users/occam/MCPs/project-agent/dist/index.js
    ```
  - If it starts, `curl http://127.0.0.1:7777/version` on the Mac mini should respond. Press Ctrl-C to stop and then load via launchd.
- Inspect logs:
  - `sudo launchctl print system/com.projectagent.mcp | sed -n '1,200p'`
  - `log show --last 15m --predicate 'process == "launchd" && eventMessage CONTAINS "com.projectagent.mcp"'`

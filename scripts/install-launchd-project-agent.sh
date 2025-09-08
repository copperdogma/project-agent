#!/usr/bin/env bash
set -euo pipefail

# Install or update a LaunchDaemon for Project Agent on a dedicated port.
# - Binds to 127.0.0.1 so it’s only reachable via your proxy/tunnel
# - Uses label: com.projectagent.mcp
# - Logs: /var/log/project-agent.(out|err).log
#
# Usage:
#   bash scripts/install-launchd-project-agent.sh \
#     --app-dir /Users/occam/MCPs/project-agent \
#     --vault-dir /Users/occam/Documents/obsidian \
#     --port 7777 \
#     [--host 127.0.0.1] [--username occam] [--skip-build]

APP_DIR="/Users/occam/MCPs/project-agent"
VAULT_DIR="/Users/occam/Documents/obsidian"
PORT="7777"
HOST="127.0.0.1"
USERNAME="occam"
LABEL="com.projectagent.mcp"
PLIST="/Library/LaunchDaemons/${LABEL}.plist"
LOG_OUT="/var/log/project-agent.out.log"
LOG_ERR="/var/log/project-agent.err.log"
SKIP_BUILD="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2;;
    --vault-dir) VAULT_DIR="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --username) USERNAME="$2"; shift 2;;
    --skip-build) SKIP_BUILD="true"; shift 1;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ ! -d "$APP_DIR" ]]; then
  echo "App dir not found: $APP_DIR" >&2
  exit 1
fi

# Preflight ownership/permissions checks
APP_OWNER="$(/usr/bin/stat -f %Su "$APP_DIR" 2>/dev/null || echo unknown)"
if [[ "$APP_OWNER" != "$USERNAME" ]]; then
  echo "Warning: $APP_DIR is owned by $APP_OWNER, but daemon user is $USERNAME." >&2
  echo "If you see EACCES during build, fix with: sudo chown -R $USERNAME:staff '$APP_DIR'" >&2
fi
if [[ -d "$APP_DIR/node_modules" && ! -w "$APP_DIR/node_modules" ]]; then
  echo "Warning: node_modules is not writable by $USERNAME. If build fails, run:" >&2
  echo "  sudo chown -R $USERNAME:staff '$APP_DIR'" >&2
fi

NODE_PATH="$(/usr/bin/which node || true)"; [[ -x "$NODE_PATH" ]] || NODE_PATH="/opt/homebrew/bin/node"
if [[ ! -x "$NODE_PATH" ]]; then
  echo "node not found. Install Node.js first (brew install node)." >&2
  exit 1
fi

cat > "/tmp/${LABEL}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  <key>UserName</key><string>${USERNAME}</string>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${APP_DIR}/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>HOME</key><string>/Users/${USERNAME}</string>
    <key>VAULT_ROOT</key><string>${VAULT_DIR}</string>
    <key>HOST</key><string>${HOST}</string>
    <key>PORT</key><string>${PORT}</string>
    <key>READONLY</key><string>false</string>
    <key>GIT_AUTO_PUSH</key><string>true</string>
    <key>GIT_REMOTE_NAME</key><string>origin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${LOG_OUT}</string>
  <key>StandardErrorPath</key><string>${LOG_ERR}</string>
</dict></plist>
PLIST

sudo mv "/tmp/${LABEL}.plist" "$PLIST"
sudo chown root:wheel "$PLIST"
sudo chmod 644 "$PLIST"
/usr/bin/plutil -lint "$PLIST"

sudo touch "$LOG_OUT" "$LOG_ERR"
sudo chmod 664 "$LOG_OUT" "$LOG_ERR"
sudo chown root:wheel "$LOG_OUT" "$LOG_ERR"

sudo launchctl unload "$PLIST" 2>/dev/null || true
sudo launchctl load -w "$PLIST"
sudo launchctl print "system/${LABEL}" | sed -n '1,120p' || true

echo "Installed and (re)loaded ${LABEL} on ${HOST}:${PORT}"

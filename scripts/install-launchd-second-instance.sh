#!/usr/bin/env bash
set -euo pipefail

# Template script to install another MCP server as a LaunchDaemon on its own port.
# Example: Twitter Scraper on 127.0.0.1:7781 with label com.twitter.scraper
#
# Usage:
#   bash scripts/install-launchd-second-instance.sh \
#     --app-dir /Users/occam/MCPs/twitter-scraper \
#     --label com.twitter.scraper \
#     --port 7781 \
#     [--host 127.0.0.1] [--username occam] [--skip-build]

APP_DIR="/Users/occam/MCPs/twitter-scraper"
LABEL="com.twitter.scraper"
PORT="7781"
HOST="127.0.0.1"
USERNAME="occam"
SKIP_BUILD="false"
SSE_ENDPOINT="/sse"
TRANSPORT="sse"
RUN_AS_ROOT="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2;;
    --label) LABEL="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --username) USERNAME="$2"; shift 2;;
    --skip-build) SKIP_BUILD="true"; shift 1;;
    --sse-endpoint) SSE_ENDPOINT="$2"; shift 2;;
    --transport) TRANSPORT="$2"; shift 2;;
    --run-as-root) RUN_AS_ROOT="true"; shift 1;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

PLIST="/Library/LaunchDaemons/${LABEL}.plist"
LOG_OUT="/var/log/${LABEL}.out.log"
LOG_ERR="/var/log/${LABEL}.err.log"

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

# Build if package.json exists and not skipped
if [[ "$SKIP_BUILD" == "false" && -f "$APP_DIR/package.json" ]]; then
  (cd "$APP_DIR" && npm ci --no-audit --no-fund && npm run build)
fi

cat > "/tmp/${LABEL}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL}</string>
  $( [[ "$RUN_AS_ROOT" == "true" ]] && echo "" || echo "<key>UserName</key><string>${USERNAME}</string>" )
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${APP_DIR}/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>HOST</key><string>${HOST}</string>
    <key>PORT</key><string>${PORT}</string>
    <key>TRANSPORT</key><string>${TRANSPORT}</string>
    <key>MCP_TRANSPORT</key><string>${TRANSPORT}</string>
    <key>SSE_ENDPOINT</key><string>${SSE_ENDPOINT}</string>
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

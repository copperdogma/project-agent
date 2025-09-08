#!/usr/bin/env bash
set -euo pipefail

# Install or update a per-user LaunchAgent for Project Agent (MCP).
# - Runs in the logged-in user session (Keychain available)
# - Reads config from .env by default (VAULT_ROOT, HOST, PORT, PROJECT_ROOTS, etc.)
# - Binds to 127.0.0.1:PORT
# - Label: com.projectagent.mcp.user
# - Logs: ~/Library/Logs/com.projectagent.mcp.user.(out|err).log
#
# Typical usage (from repo root):
#   bash scripts/launchagent-install.sh
#
# Optional overrides:
#   --app-dir <path>           Override app directory (default: repo root)
#   --vault-dir <path>         Override VAULT_ROOT (.env wins if set)
#   --port <num>               Override PORT (.env wins if set)
#   --host <ip>                Override HOST (.env wins if set)
#   --project-roots <csv>      Override PROJECT_ROOTS (.env wins if set)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${REPO_ROOT}"
VAULT_DIR="/Users/occam/Documents/obsidian"
PORT="7777"
HOST="127.0.0.1"
PROJECT_ROOTS="Projects"
LABEL_USER="com.projectagent.mcp.user"
LABEL_SYS="com.projectagent.mcp"
PLIST_USER="$HOME/Library/LaunchAgents/${LABEL_USER}.plist"
LOG_DIR="$HOME/Library/Logs"
OUT_LOG="$LOG_DIR/${LABEL_USER}.out.log"
ERR_LOG="$LOG_DIR/${LABEL_USER}.err.log"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-dir) APP_DIR="$2"; shift 2;;
    --vault-dir) VAULT_DIR="$2"; shift 2;;
    --port) PORT="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --project-roots) PROJECT_ROOTS="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if [[ ! -d "$APP_DIR" ]]; then
  echo "App dir not found: $APP_DIR" >&2
  exit 1
fi

NODE_PATH="$(/usr/bin/which node || true)"; [[ -x "$NODE_PATH" ]] || NODE_PATH="/opt/homebrew/bin/node"
if [[ ! -x "$NODE_PATH" ]]; then
  echo "node not found. Install Node.js first (brew install node)." >&2
  exit 1
fi

# Load .env (if present) to populate defaults
if [[ -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC2046
  set -a
  if ! . "$APP_DIR/.env" 2>/dev/null; then
    echo "Error: failed to read .env. If any values contain spaces (e.g., PROJECT_ROOTS), quote them like:" >&2
    echo "  PROJECT_ROOTS=\"Projects,Notes,Project Research\"" >&2
    exit 1
  fi
  set +a
fi

# Apply env overrides if set
VAULT_DIR="${VAULT_ROOT:-$VAULT_DIR}"
PORT="${PORT:-$PORT}"
HOST="${HOST:-$HOST}"
PROJECT_ROOTS="${PROJECT_ROOTS:-$PROJECT_ROOTS}"

mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR" || {
  echo "Error: cannot create ~/Library/LaunchAgents. If this directory is root-owned, fix with:" >&2
  echo "  sudo chown -R \"$USER:staff\" \"$HOME/Library/LaunchAgents\"" >&2
  exit 1
}

# Stop system LaunchDaemon to avoid port conflicts (best effort)
echo "Stopping system LaunchDaemon (if loaded)…"
if launchctl print system/${LABEL_SYS} >/dev/null 2>&1; then
  if ! sudo launchctl bootout system/${LABEL_SYS} 2>/dev/null; then
    echo "Note: could not stop system/${LABEL_SYS}. If it remains active, run:" >&2
    echo "  sudo launchctl bootout system/${LABEL_SYS}" >&2
  fi
fi

# Kill any rogue listener on the selected port (best effort)
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
  if [[ -n "${PIDS}" ]]; then
    echo "Stopping rogue listeners on :${PORT}: ${PIDS}"
    kill -TERM ${PIDS} 2>/dev/null || true
    sleep 1
    PIDS2=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "${PIDS2}" ]]; then
      echo "Force killing: ${PIDS2}"
      kill -KILL ${PIDS2} 2>/dev/null || true
    fi
  fi
fi

if [[ -f "$PLIST_USER" && ! -w "$PLIST_USER" ]]; then
  echo "Error: cannot write $PLIST_USER (permission denied). If created as root earlier, fix with:" >&2
  echo "  sudo chown $USER:staff \"$PLIST_USER\"" >&2
  exit 1
fi

cat > "$PLIST_USER" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${LABEL_USER}</string>
  <key>WorkingDirectory</key><string>${APP_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_PATH}</string>
    <string>${APP_DIR}/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    <key>HOME</key><string>${HOME}</string>
    <key>VAULT_ROOT</key><string>${VAULT_DIR}</string>
    <key>HOST</key><string>${HOST}</string>
    <key>PORT</key><string>${PORT}</string>
    <key>READONLY</key><string>false</string>
    <key>GIT_AUTO_PUSH</key><string>true</string>
    <key>GIT_REMOTE_NAME</key><string>origin</string>
    <key>PROJECT_ROOTS</key><string>${PROJECT_ROOTS}</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${OUT_LOG}</string>
  <key>StandardErrorPath</key><string>${ERR_LOG}</string>
</dict></plist>
PLIST

/usr/bin/plutil -lint "$PLIST_USER"

echo "Stopping existing agent if loaded…"
launchctl bootout gui/$(id -u)/${LABEL_USER} 2>/dev/null || true

echo "Bootstrapping LaunchAgent…"
launchctl bootstrap gui/$(id -u) "$PLIST_USER"
launchctl kickstart -kp gui/$(id -u)/${LABEL_USER}

# Port sanity: ensure the listener belongs to this LaunchAgent
sleep 1
AGENT_PID=$(launchctl print gui/$(id -u)/${LABEL_USER} 2>/dev/null | awk '/\bpid = / {print $3; exit}')
LISTENER_PIDS=""
if command -v lsof >/dev/null 2>&1; then
  LISTENER_PIDS=$(lsof -tiTCP:${PORT} -sTCP:LISTEN 2>/dev/null || true)
fi

if [[ -n "${LISTENER_PIDS}" && -n "${AGENT_PID}" ]]; then
  if ! echo " ${LISTENER_PIDS} " | grep -q " ${AGENT_PID} "; then
    echo "Conflicting listener(s) on :${PORT}: ${LISTENER_PIDS} (agent pid=${AGENT_PID}). Killing and retrying…" >&2
    kill -TERM ${LISTENER_PIDS} 2>/dev/null || true
    sleep 1
    kill -KILL ${LISTENER_PIDS} 2>/dev/null || true
    sleep 1
    launchctl kickstart -kp gui/$(id -u)/${LABEL_USER}
    sleep 1
  fi
fi

echo "Listener on :$PORT"
if command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN || true
else
  echo "(lsof not available)" >&2
fi

echo "LaunchAgent status:"
launchctl print gui/$(id -u)/${LABEL_USER} | sed -n '1,140p' || true

echo "Health:"
curl -s http://127.0.0.1:${PORT}/health || true

echo "Logs: $OUT_LOG | $ERR_LOG"

#!/usr/bin/env bash
set -euo pipefail

# Status summary for the per-user Project Agent (MCP)
# - Listener, LaunchAgent status
# - Health endpoint
# - Git repo ahead/behind vs remote
# - Recent auto-push log lines

LABEL_USER="com.projectagent.mcp.user"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${REPO_ROOT}"

# Load .env if present to get VAULT_ROOT/PORT
PORT_DEFAULT=7777
VAULT_ROOT_DEFAULT="/Users/$(id -un)/Documents/obsidian"
if [[ -f "$APP_DIR/.env" ]]; then
  set -a; . "$APP_DIR/.env"; set +a
fi
PORT="${PORT:-$PORT_DEFAULT}"
VAULT_ROOT="${VAULT_ROOT:-$VAULT_ROOT_DEFAULT}"

echo "== Listener (:${PORT}) =="
if command -v lsof >/dev/null 2>&1; then
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN || echo "(no listener)"
else
  echo "(lsof not available)"
fi

echo
echo "== LaunchAgent (${LABEL_USER}) =="
launchctl print gui/$(id -u)/${LABEL_USER} | sed -n '1,160p' || echo "(not loaded)"

echo
echo "== Health =="
curl -s http://127.0.0.1:${PORT}/health || echo "(health unavailable)"
echo

echo
echo "== Git status (${VAULT_ROOT}) =="
if [[ -d "$VAULT_ROOT/.git" ]]; then
  BRANCH="$(git -C "$VAULT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
  REMOTE="origin"
  AHEAD_BEHIND="$(git -C "$VAULT_ROOT" rev-list --left-right --count HEAD...${REMOTE}/${BRANCH} 2>/dev/null || echo "0\t0")"
  echo "branch=$BRANCH remote=$REMOTE ahead_behind=$AHEAD_BEHIND"
else
  echo "(not a git repo)"
fi

echo
echo "== Recent auto-push logs =="
LOG_FILE="$HOME/Library/Logs/com.projectagent.mcp.user.out.log"
if [[ -f "$LOG_FILE" ]]; then
  rg -n "auto-push" "$LOG_FILE" -n -e 'auto-push' | tail -n 50 || true
else
  echo "(no user log at $LOG_FILE)"
fi


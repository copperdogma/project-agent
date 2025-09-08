#!/usr/bin/env bash
set -euo pipefail

# Start two Cloudflare Quick Tunnels for two local MCP servers.
# Requires: brew install cloudflared
#
# Usage:
#   bash scripts/start-quick-tunnels.sh \
#     --agent-port 7777 \
#     --twitter-port 7781

AGENT_PORT=7777
TWITTER_PORT=7781

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent-port) AGENT_PORT="$2"; shift 2;;
    --twitter-port) TWITTER_PORT="$2"; shift 2;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install with: brew install cloudflared" >&2
  exit 1
fi

echo "Starting Quick Tunnel for Project Agent on http://127.0.0.1:${AGENT_PORT} ..."
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${AGENT_PORT}" &
PID1=$!

echo "Starting Quick Tunnel for Twitter on http://127.0.0.1:${TWITTER_PORT} ..."
cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:${TWITTER_PORT}" &
PID2=$!

echo "Launched cloudflared PIDs: $PID1, $PID2"
echo "Watch output for URLs (look for https://*.trycloudflare.com)"
echo "Press Ctrl+C to stop both tunnels"

wait


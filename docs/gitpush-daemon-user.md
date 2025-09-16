User-Mode Git Push Daemon (Recommended)

Problem: Running a system LaunchDaemon as root against the Obsidian vault created root‑owned `.git/objects/*` prefixes, causing user commits to fail with:

  "insufficient permission for adding an object to repository database .git/objects"

Fix: Run any timed git sync as the vault user (`occam`) or prefer the per‑user LaunchAgent.

Per‑user LaunchAgent (preferred)

1) Install the helper script and agent from the repo root:

```bash
bash scripts/setup-user-gitbackup-agent.sh
```

This installs `~/Library/LaunchAgents/com.projectagent.gitbackup.user.plist` which stages/commits local changes and pushes every 180s.

System LaunchDaemon (if you must use system domain)

If you require a system daemon, include `<UserName>occam</UserName>` so it runs as the vault user:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.projectagent.gitpush</string>
  <key>UserName</key><string>occam</string>
  <key>WorkingDirectory</key><string>/Users/occam/Documents/obsidian</string>
  <key>ProgramArguments</key>
  <array><string>/usr/local/bin/obsidian-auto-push.sh</string></array>
  <key>StartInterval</key><integer>180</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>/var/log/project-agent.push.out.log</string>
  <key>StandardErrorPath</key><string>/var/log/project-agent.push.err.log</string>
</dict></plist>
```

Use a safer script that commits and pushes (not only push), and skips if `.git/index.lock` exists:

```bash
#!/usr/bin/env bash
set -euo pipefail
VAULT="/Users/occam/Documents/obsidian"
GIT="/usr/bin/git"
[ -d "$VAULT/.git" ] || exit 0
[ -f "$VAULT/.git/index.lock" ] && exit 0
$GIT config --global --add safe.directory "$VAULT" >/dev/null 2>&1 || true
BRANCH="$($GIT -C "$VAULT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"
STATUS="$($GIT -C "$VAULT" status --porcelain 2>/dev/null || true)"
if [ -n "$STATUS" ]; then
  TS="$(date '+%Y-%m-%d %H:%M:%S %Z')"
  $GIT -C "$VAULT" add -A
  $GIT -C "$VAULT" -c user.name='Obsidian Backup' -c user.email='obsidian@local' commit -m "vault backup: ${TS}" || true
fi
$GIT -C "$VAULT" pull --rebase --autostash origin "$BRANCH" >/dev/null 2>&1 || true
$GIT -C "$VAULT" push -q origin HEAD:"$BRANCH" >/dev/null 2>&1 || true
```

After editing the system plist, reload:

```bash
sudo launchctl unload /Library/LaunchDaemons/com.projectagent.gitpush.plist
sudo launchctl load -w /Library/LaunchDaemons/com.projectagent.gitpush.plist
```

Diagnostics

Run from the repo root:

```bash
bash scripts/obsidian-perms-check.sh
```

Use `--fix` to repair ownership and `--unload-root-daemon` to disable the root daemon.


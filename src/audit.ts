import fs from "fs";
import path from "path";
import { getVaultRoot } from "./vault.js";

export interface AuditEntry {
  ts: string; // ISO string
  email: string;
  tool: string;
  slug?: string;
  summary?: string[];
  commit?: string | null;
  details?: Record<string, unknown>;
}

function auditLogPath(): string {
  const root = getVaultRoot();
  const dir = path.join(root, ".project-agent", "logs");
  fs.mkdirSync(dir, { recursive: true });
  // Ensure .project-agent/.gitignore ignores app-generated artifacts to keep workdir clean
  try {
    const ignoreFile = path.join(root, ".project-agent", ".gitignore");
    if (!fs.existsSync(ignoreFile)) {
      const contents = [
        "# Ignored app artifacts",
        "logs/",
        "idempotency/",
        "*.lock",
        "",
      ].join("\n");
      fs.writeFileSync(ignoreFile, contents, "utf8");
    }
  } catch {
    // best effort
  }
  return path.join(dir, "audit.jsonl");
}

export function writeAudit(entry: AuditEntry): void {
  try {
    const line = JSON.stringify({ ...entry, ts: entry.ts || new Date().toISOString() }) + "\n";
    fs.appendFileSync(auditLogPath(), line, "utf8");
  } catch {
    // best effort; do not throw
  }
}



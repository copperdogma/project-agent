import fs from "fs";
import path from "path";

export type LineEndingStyle = "lf" | "crlf" | "cr";

export interface ResolvedVaultPath {
  absolutePath: string;
  relativePathFromVault: string;
}

const DEFAULT_VAULT_ROOT = 
  process.env.VAULT_ROOT || 
  "/Users/cam/Library/Mobile Documents/iCloud~md~obsidian/Documents/obsidian/";

function ensureAbsolutePath(p: string): string {
  if (path.isAbsolute(p)) return p;
  return path.join(process.cwd(), p);
}

export function getVaultRoot(): string {
  const absolute = ensureAbsolutePath(DEFAULT_VAULT_ROOT);
  return path.resolve(absolute);
}

/**
 * Resolve a user-provided path safely under VAULT_ROOT, denying traversal outside the vault.
 * The input may be absolute or relative; only paths that remain within the vault are allowed.
 */
export function safePathResolve(root: string, inputPath: string): ResolvedVaultPath {
  const vaultRoot = path.resolve(root);
  const candidate = path.resolve(path.isAbsolute(inputPath) ? inputPath : path.join(vaultRoot, inputPath));

  // Normalize and verify containment
  const vaultWithSep = vaultRoot.endsWith(path.sep) ? vaultRoot : vaultRoot + path.sep;
  const candidateWithSep = candidate + path.sep;
  if (!(candidate === vaultRoot || candidateWithSep.startsWith(vaultWithSep))) {
    throw new Error("PATH_TRAVERSAL_DENIED: Attempted to access outside VAULT_ROOT");
  }

  const relative = path.relative(vaultRoot, candidate);
  return { absolutePath: candidate, relativePathFromVault: relative };
}

function lockfilePath(filePath: string): string {
  return `${filePath}.lock`;
}

/**
 * Acquire a simple lock by creating a lockfile atomically. Throws if already locked.
 * Not safe across NFS or non-POSIX filesystems but sufficient for local dev.
 */
export function acquireLock(filePath: string): void {
  const lf = lockfilePath(filePath);
  try {
    const fd = fs.openSync(lf, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
  } catch (err: any) {
    if (err && err.code === "EEXIST") {
      throw new Error("FILE_LOCKED: Another process is writing this file");
    }
    throw err;
  }
}

export function releaseLock(filePath: string): void {
  const lf = lockfilePath(filePath);
  try {
    if (fs.existsSync(lf)) fs.unlinkSync(lf);
  } catch {
    // Best effort
  }
}

export function detectLineEnding(content: string): LineEndingStyle {
  // Order matters: CRLF first, then CR, default LF
  if (content.includes("\r\n")) return "crlf";
  if (content.includes("\r")) return "cr";
  return "lf";
}

export function normalizeLineEndings(content: string, to: LineEndingStyle): string {
  // Convert all to LF first
  const asLf = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (to === "lf") return asLf;
  if (to === "crlf") return asLf.replace(/\n/g, "\r\n");
  return asLf.replace(/\n/g, "\r");
}

export function readFileSafely(relativePath: string): { content: string; lineEnding: LineEndingStyle; absolutePath: string } {
  const { absolutePath } = safePathResolve(getVaultRoot(), relativePath);
  const buf = fs.readFileSync(absolutePath);
  const text = buf.toString("utf8");
  const le = detectLineEnding(text);
  return { content: text, lineEnding: le, absolutePath };
}

export function writeFileSafely(relativePath: string, data: string, preserve?: LineEndingStyle): void {
  const { absolutePath } = safePathResolve(getVaultRoot(), relativePath);
  // Ensure parent exists
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  acquireLock(absolutePath);
  try {
    const finalData = preserve ? normalizeLineEndings(data, preserve) : data;
    fs.writeFileSync(absolutePath, finalData, { encoding: "utf8" });
  } finally {
    releaseLock(absolutePath);
  }
}

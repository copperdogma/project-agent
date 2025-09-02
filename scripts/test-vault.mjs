import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  const vault = await import(new URL("../dist/vault.js", import.meta.url));

  const { safePathResolve, readFileSafely, writeFileSafely, acquireLock, releaseLock, getVaultRoot } = vault;

  // getVaultRoot resolves to tmpRoot
  const root = getVaultRoot();
  if (!root.startsWith(tmpRoot)) throw new Error("getVaultRoot not using test root");

  // Normal resolution inside vault
  const p1 = safePathResolve(root, "Projects/test.md");
  if (!p1.absolutePath.startsWith(root)) throw new Error("Path should be inside vault");

  // Deny traversal
  let threw = false;
  try {
    safePathResolve(root, "../outside.txt");
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Traversal outside vault should throw");

  // Deny absolute outside
  threw = false;
  try {
    const outside = path.join(os.tmpdir(), "definitely-outside.txt");
    safePathResolve(root, outside);
  } catch {
    threw = true;
  }
  if (!threw) throw new Error("Absolute outside access should throw");

  // Read/write + line endings
  const rel = "Projects/lines.md";
  writeFileSafely(rel, "a\nb\n", undefined);
  const r1 = readFileSafely(rel);
  if (r1.lineEnding !== "lf") throw new Error(`Expected lf, got ${r1.lineEnding}`);

  writeFileSafely(rel, "a\nb\n", "crlf");
  const r2 = readFileSafely(rel);
  if (!r2.content.includes("\r\n")) throw new Error("Expected CRLF content");

  // Lock behavior
  const { absolutePath } = vault.safePathResolve(root, rel);
  acquireLock(absolutePath);
  let locked = false;
  try {
    acquireLock(absolutePath);
  } catch {
    locked = true;
  }
  releaseLock(absolutePath);
  if (!locked) throw new Error("Expected second lock attempt to fail");

  // Cleanup
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: vault tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("vault tests failed", err);
  process.exit(1);
});

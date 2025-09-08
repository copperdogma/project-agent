import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  const { checkVaultWritable } = await import("../dist/health.js");

  // Writable case
  if (checkVaultWritable() !== true) throw new Error("expected writable true");

  // Monkeypatch fs.writeFileSync to simulate EACCES
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = function(p, d) {
    if (String(p).includes(".write-test.tmp")) {
      const err = new Error("EACCES: permission denied");
      // @ts-ignore
      err.code = "EACCES";
      throw err;
    }
    return realWrite.apply(this, [p, d]);
  };
  try {
    if (checkVaultWritable() !== false) throw new Error("expected writable false on EACCES");
  } finally {
    fs.writeFileSync = realWrite;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: health writable check");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("vault writable test failed", err);
  process.exit(1);
});

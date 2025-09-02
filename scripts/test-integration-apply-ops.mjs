import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(path.join(projectsDir, "Doc.md"), `---\ntitle: Doc\nslug: doc\n---\n# Notes\nSeed ^seed01\n`, "utf8");

  // Initialize git repo for diff/commit
  const { simpleGit } = await import("simple-git");
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init();
  await git.add(".");
  await git.commit("init");

  const mod = await import(new URL("../dist/apply.js", import.meta.url));
  const before = await (await import(new URL("../dist/snapshot.js", import.meta.url))).buildSnapshot("doc");
  const res = await mod.applyOps({ slug: "doc", ops: [{ type: "append", section: "Notes", text: "First" }], idempotency_key: "k1" });
  if (!res.commit) throw new Error("missing commit");
  if (!res.diff.includes("+")) throw new Error("missing diff add");

  // Idempotency replay should not make changes
  const res2 = await mod.applyOps({ slug: "doc", ops: [{ type: "append", section: "Notes", text: "First" }], idempotency_key: "k1" });
  if (!res2.summary.includes("idempotent_replay")) throw new Error("idempotency not replayed");

  const after = await (await import(new URL("../dist/snapshot.js", import.meta.url))).buildSnapshot("doc");
  if (after.size_bytes <= before.size_bytes) throw new Error("file not grown after append");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: integration applyOps passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("integration applyOps failed", err);
  process.exit(1);
});



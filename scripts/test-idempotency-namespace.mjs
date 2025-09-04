import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.IDEMPOTENCY_TTL_S = "3600"; // enable replay storage
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectsDir, "A.md"),
    `---\ntitle: A\nslug: a\n---\n# Notes\nSeed ^seed01\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(projectsDir, "B.md"),
    `---\ntitle: B\nslug: b\n---\n# Notes\nSeed ^seed01\n`,
    "utf8",
  );

  // Initialize git repo for commits
  const { simpleGit } = await import("simple-git");
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init();
  await git.add(".");
  await git.commit("init");

  const apply = await import(new URL("../dist/apply.js", import.meta.url));
  const snap = await import(new URL("../dist/snapshot.js", import.meta.url));

  const key = "shared-key";
  const first = await apply.applyOps({
    slug: "a",
    ops: [{ type: "append", section: "Notes", text: "FromA" }],
    idempotency_key: key,
  });
  if (!first.commit) throw new Error("first commit missing");

  const beforeB = await snap.buildSnapshot("b");
  const second = await apply.applyOps({
    slug: "b",
    ops: [{ type: "append", section: "Notes", text: "FromB" }],
    idempotency_key: key,
  });
  if (second.summary.includes("idempotent_replay")) throw new Error("namespacing failed: replay occurred across slugs");
  const afterB = await snap.buildSnapshot("b");
  if (!(afterB.size_bytes > beforeB.size_bytes)) throw new Error("doc B did not grow after append");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: idempotency namespacing passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("idempotency namespacing test failed", err);
  process.exit(1);
});



import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.IDEMPOTENCY_TTL_S = "0"; // disable storage/replay
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(
    path.join(projectsDir, "TTL Doc.md"),
    `---\ntitle: TTL Doc\nslug: ttl-doc\n---\n# Notes\nSeed ^seed01\n`,
    "utf8",
  );

  // Initialize git repo for commits
  const { simpleGit } = await import("simple-git");
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init();
  await git.add(".");
  await git.commit("init");

  const apply = await import(new URL("../dist/apply.js", import.meta.url));

  const key = "same-key";
  const first = await apply.applyOps({
    slug: "ttl-doc",
    ops: [{ type: "append", section: "Notes", text: "First" }],
    idempotency_key: key,
  });
  if (!first || first.summary.includes("idempotent_replay")) throw new Error("first call should not be replay");

  // With TTL disabled, second call should NOT replay idempotently
  const second = await apply.applyOps({
    slug: "ttl-doc",
    ops: [{ type: "append", section: "Notes", text: "First" }],
    idempotency_key: key,
  });
  if (second.summary.includes("idempotent_replay")) throw new Error("TTL=0 must disable idempotency replay");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: idempotency TTL behavior passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("idempotency TTL test failed", err);
  process.exit(1);
});



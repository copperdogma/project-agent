import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(path.join(projectsDir, "Doc.md"), `# Notes\nLine\n`, "utf8");

  const { simpleGit } = await import("simple-git");
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init();
  await git.add(".");
  await git.commit("init");

  // make a committing change
  fs.appendFileSync(path.join(projectsDir, "Doc.md"), "Added\n");
  await git.add(".");
  await git.commit("change");
  const latest = (await git.revparse(["HEAD"]))?.trim();

  const { undoCommit } = await import(new URL("../dist/undo.js", import.meta.url));
  const res = await undoCommit({ commit: latest });
  if (!res.revert_commit) throw new Error("missing revert commit");
  if (!res.diff || !res.diff.includes("-")) throw new Error("missing revert diff");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: undo tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("undo tests failed", err);
  process.exit(1);
});



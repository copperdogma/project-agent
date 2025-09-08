import fs from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  const bareRoot = fs.mkdtempSync(path.join(os.tmpdir(), "remote-"));
  const bareRepo = path.join(bareRoot, "origin.git");
  fs.mkdirSync(bareRepo, { recursive: true });

  // Init bare remote
  await simpleGit().cwd(bareRepo).raw(["init", "--bare"]);

  // Init working repo as VAULT_ROOT
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.GIT_AUTO_PUSH = "true";
  process.env.GIT_REMOTE_NAME = "origin";
  process.env.GIT_BRANCH = "main";

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Create initial file with frontmatter and one section so append can work
  const md = [
    "---",
    "title: Push Doc",
    "slug: push-doc",
    "---",
    "# Notes",
    "Seed ^seed01",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(projectsDir, "Push Doc.md"), md, "utf8");

  // Init git in working repo
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init(["-b", "main"]);
  await git.addConfig("user.email", "robot@local");
  await git.addConfig("user.name", "Project Agent");
  await git.add(["."]); // stage initial files
  await git.commit("init");
  await git.addRemote("origin", bareRepo);
  await git.push(["-u", "origin", "main"]);

  // Wire tools and append
  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(toolName, args) {
    const handler = tools.get(toolName);
    const res = await handler(args ?? {});
    const body = JSON.parse(res.content?.[0]?.text ?? "{}");
    return body;
  }

  const beforeHead = (await git.revparse(["HEAD"]))?.trim();
  const res = await call("project_append", { slug: "push-doc", section: "Notes", text: "Pushed via tool" });
  if (res?.error) throw new Error(`append error: ${JSON.stringify(res)}`);
  const afterHead = (await git.revparse(["HEAD"]))?.trim();
  if (beforeHead === afterHead) throw new Error("expected new commit after append");

  // Verify remote advanced to afterHead
  const ls = await git.listRemote(["--heads", "origin", "refs/heads/main"]);
  const m = /^(\w+)\s+refs\/heads\/main/m.exec(ls);
  if (!m) throw new Error(`ls-remote did not return main head: ${ls}`);
  const remoteHead = m[1];
  if (remoteHead !== afterHead) {
    throw new Error(`remote head mismatch: expected ${afterHead} got ${remoteHead}`);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(bareRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: git auto-push after append");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("git auto-push test failed", err);
  process.exit(1);
});


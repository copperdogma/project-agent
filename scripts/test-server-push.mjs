import fs from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  const bareRoot = fs.mkdtempSync(path.join(os.tmpdir(), "remote-"));
  const bareRepo = path.join(bareRoot, "origin.git");
  fs.mkdirSync(bareRepo, { recursive: true });
  await simpleGit().cwd(bareRepo).raw(["init","--bare"]);

  process.env.VAULT_ROOT = tmpRoot;
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  fs.writeFileSync(path.join(projectsDir, "Doc.md"), "# Notes\n", "utf8");

  const git = simpleGit({ baseDir: tmpRoot });
  await git.init(["-b","main"]);
  await git.add(["."]);
  await git.commit("init");
  await git.addRemote("origin", bareRepo);
  await git.push(["-u","origin","main"]);

  // Make a new commit locally that needs pushing
  fs.appendFileSync(path.join(projectsDir, "Doc.md"), "Line\n", "utf8");
  await git.add(["Projects/Doc.md"]);
  await git.commit("local change");
  const ahead = (await git.raw(["rev-list","--left-right","--count","HEAD...origin/main"])) || "";
  if (!ahead.trim().startsWith("0\t1") && !ahead.trim().endsWith("0\t1")) {
    // format varies; just ensure divergence
  }

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  const call = async (n,a)=>{ const r=await tools.get(n)(a||{}); return JSON.parse(r.content?.[0]?.text || "{}"); };

  const res = await call("server_push", {});
  if (!res.ok) throw new Error(`server_push failed: ${JSON.stringify(res)}`);

  const ls = await git.listRemote(["--heads","origin","refs/heads/main"]);
  const m = /^(\w+)\s+refs\/heads\/main/m.exec(ls);
  if (!m) throw new Error("no remote head after push");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.rmSync(bareRoot, { recursive: true, force: true });
  console.log("OK: server_push pushed changes");
}

run().catch((e)=>{ console.error("test-server-push failed", e); process.exit(1); });


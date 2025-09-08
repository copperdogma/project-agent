import fs from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.PROJECT_ROOTS = "Projects,Notes,Project Research";
  fs.mkdirSync(path.join(tmpRoot, "Projects"), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, "Notes"), { recursive: true });

  const git = simpleGit({ baseDir: tmpRoot });
  await git.init(["-b","main"]);

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(n, a) { const r = await tools.get(n)(a||{}); return JSON.parse(r.content?.[0]?.text ?? "{}"); }

  // For now, we’ll set folder via extended param name (to be supported in create tool)
  const res = await call("project_create", { title: "Inbox 2025-09-08", folder: "Notes" });
  if (res.error) throw new Error(`create error: ${JSON.stringify(res)}`);
  if (!String(res.path).includes("Notes/")) throw new Error(`expected Notes path, got ${res.path}`);

  const list = await call("project_list");
  const found = list.find((x) => x.slug === res.slug);
  if (!found || found.folder !== "Notes") throw new Error("list missing folder=Notes for created doc");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log("OK: create in folder Notes");
}

run().catch((e)=>{ console.error("test-create-in-folder failed", e); process.exit(1); });


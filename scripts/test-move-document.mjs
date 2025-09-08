import fs from "fs";
import os from "os";
import path from "path";
import { simpleGit } from "simple-git";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.PROJECT_ROOTS = "Projects,Notes,Project Research";
  process.env.GIT_AUTO_PUSH = "false";

  fs.mkdirSync(path.join(tmpRoot, "Projects"), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, "Project Research"), { recursive: true });

  const md = ["---","title: ESP32 Power","slug: esp32-power","---","# Notes","Seed ^seed01",""].join("\n");
  fs.writeFileSync(path.join(tmpRoot, "Project Research", "ESP32 Power.md"), md, "utf8");

  const git = simpleGit({ baseDir: tmpRoot });
  await git.init(["-b","main"]);
  await git.add(["."]); await git.commit("init");

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(n, a) { const r = await tools.get(n)(a||{}); return JSON.parse(r.content?.[0]?.text ?? "{}"); }

  const slug = "esp32-power";
  const move = await call("project_move_document", { slug, toFolder: "Projects" });
  if (move.error) throw new Error(`move error: ${JSON.stringify(move)}`);
  if (!String(move.newPath || "").includes("Projects/")) throw new Error(`expected moved to Projects; got ${move.newPath}`);

  const snap = await call("project_snapshot", { slug });
  if (!String(snap.path).includes("Projects/")) throw new Error("snapshot path not updated to Projects");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log("OK: move document between folders");
}

run().catch((e)=>{ console.error("test-move-document failed", e); process.exit(1); });


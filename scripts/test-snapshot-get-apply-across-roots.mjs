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

  const notesDir = path.join(tmpRoot, "Notes");
  fs.mkdirSync(notesDir, { recursive: true });
  const md = ["---","title: Daily Note","slug: daily-note","---","# Notes","Seed ^seed01",""].join("\n");
  fs.writeFileSync(path.join(notesDir, "Daily Note.md"), md, "utf8");

  // Git init to verify commits work
  const git = simpleGit({ baseDir: tmpRoot });
  await git.init(["-b","main"]);
  await git.add(["."]); await git.commit("init");

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(n, a) { const r = await tools.get(n)(a||{}); return JSON.parse(r.content?.[0]?.text ?? "{}"); }

  const slug = "daily-note";
  const snap = await call("project_snapshot", { slug });
  if (snap.error) throw new Error(`snapshot error: ${JSON.stringify(snap)}`);
  if (!snap.path || snap.path.indexOf("Notes/") !== 0) throw new Error(`expected path under Notes: ${snap.path}`);

  const doc = await call("project_get_document", { slug, suppressContent: true });
  if (doc.error) throw new Error(`get error: ${JSON.stringify(doc)}`);

  const append = await call("project_append", { slug, section: "Notes", text: "Appended line" });
  if (append.error) throw new Error(`append error: ${JSON.stringify(append)}`);
  if (!append.summary.some((s)=>s.startsWith("append:"))) throw new Error("append summary missing");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log("OK: snapshot/get/append across Notes root");
}

run().catch((e) => { console.error("test-snapshot-get-apply-across-roots failed", e); process.exit(1); });


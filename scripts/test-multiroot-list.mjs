import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.PROJECT_ROOTS = "Projects,Notes,Project Research";

  const mk = (p) => fs.mkdirSync(p, { recursive: true });
  mk(path.join(tmpRoot, "Projects"));
  mk(path.join(tmpRoot, "Notes"));
  mk(path.join(tmpRoot, "Project Research"));

  fs.writeFileSync(path.join(tmpRoot, "Projects", "A Project.md"), "# Notes\n", "utf8");
  fs.writeFileSync(path.join(tmpRoot, "Notes", "Daily 2025-09-08.md"), "# Notes\n", "utf8");
  fs.writeFileSync(path.join(tmpRoot, "Project Research", "ESP32 Power.md"), "# Notes\n", "utf8");

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);

  async function call(name, args) {
    const h = tools.get(name);
    const res = await h(args || {});
    return JSON.parse(res.content?.[0]?.text ?? "{}");
  }

  const list = await call("project_list");
  if (!Array.isArray(list) || list.length !== 3) throw new Error("expected 3 entries across roots");
  const folders = new Set(list.map((x) => x.folder));
  const got = [...folders].sort().join(",");
  const want = ["Notes","Project Research","Projects"].sort().join(",");
  if (got !== want) throw new Error(`unexpected folders: ${got}`);
  if (!list.every((x) => typeof x.path === "string" && typeof x.folder === "string")) {
    throw new Error("expected path and folder on each list item");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log("OK: multi-root list with folder & path");
}

run().catch((e) => { console.error("test-multiroot-list failed", e); process.exit(1); });

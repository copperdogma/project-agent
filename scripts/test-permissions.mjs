import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const mdPath = path.join(projectsDir, "Perm Doc.md");
  const md = [
    "---",
    "title: Perm Doc",
    "slug: perm-doc",
    "---",
    "# Notes",
    "Seed ^seed01",
    "",
  ].join("\n");
  fs.writeFileSync(mdPath, md, "utf8");

  // Monkeypatch fs.writeFileSync to simulate EACCES for this file only
  const realWrite = fs.writeFileSync;
  fs.writeFileSync = function(pathLike, data, options) {
    const p = String(pathLike);
    if (p.includes("Perm Doc.md")) {
      const err = new Error("EACCES: permission denied, open '" + p + "'");
      // @ts-ignore
      err.code = "EACCES";
      throw err;
    }
    return realWrite.apply(this, [pathLike, data, options]);
  };

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

  const res = await call("project_append", { slug: "perm-doc", section: "Notes", text: "Should fail with permissions" });
  if (!res?.error) throw new Error("expected error for read-only file");
  if (res.error.code !== "READ_ONLY") throw new Error(`expected READ_ONLY, got ${res.error.code}`);

  // Restore fs and cleanup
  fs.writeFileSync = realWrite;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: permission error mapped to READ_ONLY");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("permission test failed", err);
  process.exit(1);
});

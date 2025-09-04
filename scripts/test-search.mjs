import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const md = `---\ntitle: Search Doc\nslug: search-doc\n---\n# Uncategorized\nA simple example line ^a1b2c3\n# Notes\nAnother Line with Token ^n1n2n3\n`;
  fs.writeFileSync(path.join(projectsDir, "Search Doc.md"), md, "utf8");

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

  const all = await call("project_search", { slug: "search-doc", query: "line" });
  if (!Array.isArray(all.matches) || all.matches.length < 2) throw new Error("search: expected 2+ matches for 'line'");

  const sec = await call("project_search", { slug: "search-doc", query: "token", scope: "section", section: "Notes" });
  if (!Array.isArray(sec.matches) || sec.matches.length !== 1) throw new Error("search: expected 1 match for section search");
  if (!sec.matches[0].anchor || !sec.matches[0].excerpt.toLowerCase().includes("token")) throw new Error("search: missing anchor or excerpt");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: search tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("search tests failed", err);
  process.exit(1);
});



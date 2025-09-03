import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // seed a simple project
  const md = `---\ntitle: Test\nslug: test\n---\n# Uncategorized\n20250101 ai: Hello ^u1abc0\n`;
  fs.writeFileSync(path.join(projectsDir, "Test.md"), md, "utf8");

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));

  // Minimal stub to capture tool registrations
  const tools = new Map();
  const server = {
    registerTool(name, _schema, handler) {
      tools.set(name, handler);
    },
  };
  registerProjectTools(server);

  async function call(toolName, args) {
    const handler = tools.get(toolName);
    if (!handler) throw new Error(`missing tool ${toolName}`);
    const res = await handler(args ?? {});
    const body = JSON.parse(res.content?.[0]?.text ?? "{}");
    return body;
  }

  // 1) Error wrapping: snapshot/getDocument with missing slug should return NOT_FOUND error
  {
    const res = await call("project_snapshot", { slug: "nope" });
    if (!res.error || res.error.code !== "NOT_FOUND") throw new Error("expected NOT_FOUND from snapshot");
  }

  // 2) Read-only guards on write tools
  process.env.READONLY = "true";
  {
    const res = await call("project_apply_ops", { slug: "test", ops: [] });
    if (!res.error || res.error.code !== "READ_ONLY") throw new Error("expected READ_ONLY from apply_ops");
  }
  {
    const res = await call("project_create", { title: "X" });
    if (!res.error || res.error.code !== "READ_ONLY") throw new Error("expected READ_ONLY from create");
  }
  {
    const res = await call("project_undo", { commit: "deadbeef" });
    if (!res.error || res.error.code !== "READ_ONLY") throw new Error("expected READ_ONLY from undo");
  }

  // 3) Non-readonly read paths still work
  delete process.env.READONLY;
  {
    const res = await call("project_snapshot", { slug: "test" });
    if (!res.frontmatter || res.frontmatter.slug !== "test") throw new Error("snapshot ok path failed");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: MCP error wrapping and READONLY guards passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("mcp errors/readonly tests failed", err);
  process.exit(1);
});



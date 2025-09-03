import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // seed a simple project with sections and anchors
  const md = `---\ntitle: Test\nslug: test\n---\n# Uncategorized\n20250101 ai: A ^a11111\n# Notes\n20250101 ai: N ^n11111\n`;
  fs.writeFileSync(path.join(projectsDir, "Test.md"), md, "utf8");

  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));

  // Minimal stub
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(toolName, args) {
    const handler = tools.get(toolName);
    const res = await handler(args ?? {});
    const body = JSON.parse(res.content?.[0]?.text ?? "{}");
    return body;
  }

  // 1) NOT_FOUND_ANCHOR via update with bogus anchor
  {
    const res = await call("project_apply_ops", { slug: "test", ops: [{ type: "update_by_anchor", anchor: "^zzzzzz", new_text: "x" }] });
    if (!res.error || res.error.code !== "NOT_FOUND_ANCHOR") throw new Error("expected NOT_FOUND_ANCHOR");
  }

  // 2) VALIDATION_ERROR via missing section on append
  {
    const res = await call("project_apply_ops", { slug: "test", ops: [{ type: "append", section: "Missing", text: "hello" }] });
    if (!res.error || res.error.code !== "VALIDATION_ERROR") throw new Error("expected VALIDATION_ERROR for missing section");
  }

  // 3) CONFLICT via expected_commit mismatch
  {
    const snap = await call("project_snapshot", { slug: "test" });
    const badExpected = snap.current_commit ? snap.current_commit + "dead" : "abcd";
    const res = await call("project_apply_ops", { slug: "test", ops: [], expected_commit: badExpected });
    if (!res.error || res.error.code !== "CONFLICT") throw new Error("expected CONFLICT on expected_commit");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: MCP canonical error codes passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("mcp error code tests failed", err);
  process.exit(1);
});



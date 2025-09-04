import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.MAX_OPS_PER_CALL = "2";
  process.env.MAX_LINE_LENGTH = String(1024);
  process.env.SNAPSHOT_MAX_BYTES = String(256 * 1024);

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });
  const md = `---\nslug: limits-doc\n---\n# Uncategorized\nseed ^aaaaaa\n# Notes\nhello\n`;
  fs.writeFileSync(path.join(projectsDir, "Limits Doc.md"), md, "utf8");

  const { applyOps } = await import(new URL("../dist/apply.js", import.meta.url));
  const { buildSnapshot } = await import(new URL("../dist/snapshot.js", import.meta.url));
  const { registerProjectTools } = await import(new URL("../dist/tools/register.js", import.meta.url));

  // 1) MAX_OPS_PER_CALL enforcement
  let threw = false;
  try {
    await applyOps({ slug: "limits-doc", ops: [
      { type: "append", section: "Notes", text: "a" },
      { type: "append", section: "Notes", text: "b" },
      { type: "append", section: "Notes", text: "c" },
    ]});
  } catch (e) {
    threw = /PAYLOAD_TOO_LARGE/i.test(String(e));
  }
  if (!threw) throw new Error("limits: expected PAYLOAD_TOO_LARGE for too many ops");

  // 2) MAX_LINE_LENGTH enforcement
  threw = false;
  try {
    await applyOps({ slug: "limits-doc", ops: [
      { type: "update_by_anchor", anchor: "^aaaaaa", new_text: "X".repeat(2000) },
    ]});
  } catch (e) {
    threw = /PAYLOAD_TOO_LARGE/i.test(String(e));
  }
  if (!threw) throw new Error("limits: expected PAYLOAD_TOO_LARGE for long line");

  // 3) Snapshot warnings + size limit through tool handler
  // Seed a big file below limit
  const big = `# Uncategorized\n` + ("Y".repeat(1000) + " ^y1\n").repeat(100);
  fs.writeFileSync(path.join(projectsDir, "Big.md"), big, "utf8");

  // Use tool wrapper for snapshot limit enforcement
  const tools = new Map();
  const server = { registerTool(name, _schema, handler) { tools.set(name, handler); } };
  registerProjectTools(server);
  async function call(toolName, args) {
    const handler = tools.get(toolName);
    const res = await handler(args ?? {});
    const body = JSON.parse(res.content?.[0]?.text ?? "{}");
    return body;
  }

  const okSnap = await call("project_snapshot", { slug: "limits-doc" });
  if (okSnap.error) throw new Error("limits: unexpected error on small snapshot");

  // Force a low limit to trigger error
  process.env.SNAPSHOT_MAX_BYTES = "64";
  const tooBig = await call("project_snapshot", { slug: "limits-doc" });
  if (!tooBig.error || tooBig.error.code !== "PAYLOAD_TOO_LARGE") {
    throw new Error("limits: expected PAYLOAD_TOO_LARGE from tool snapshot");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: limits and validation tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("limits tests failed", err);
  process.exit(1);
});



import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  process.env.EMAIL_OVERRIDE = "tester@example.com";
  process.env.RATE_LIMIT_WRITE_MAX = "2"; // allow two writes per minute
  process.env.RATE_LIMIT_WRITE_WINDOW_S = "60";

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const md = `---\ntitle: Test\nslug: test\n---\n# Uncategorized\n20250101 ai: A ^a11111\n`;
  fs.writeFileSync(path.join(projectsDir, "Test.md"), md, "utf8");

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

  // 1) Two writes should pass; third should be RATE_LIMITED
  const ok1 = await call("project_apply_ops", { slug: "test", ops: [{ type: "append", section: "Uncategorized", text: "x" }] });
  if (ok1.error) throw new Error("first write unexpectedly failed");
  const ok2 = await call("project_apply_ops", { slug: "test", ops: [{ type: "append", section: "Uncategorized", text: "y" }] });
  if (ok2.error) throw new Error("second write unexpectedly failed");
  const limited = await call("project_apply_ops", { slug: "test", ops: [{ type: "append", section: "Uncategorized", text: "z" }] });
  if (!limited.error || limited.error.code !== "RATE_LIMITED") throw new Error("expected RATE_LIMITED on third write");

  // 2) Audit file exists and contains entries
  const auditPath = path.join(tmpRoot, ".project-agent", "logs", "audit.jsonl");
  if (!fs.existsSync(auditPath)) throw new Error("audit.jsonl not written");
  const lines = fs.readFileSync(auditPath, "utf8").trim().split(/\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("expected at least two audit entries");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: auditing and per-email/slug rate limiting passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("audit/rate tests failed", err);
  process.exit(1);
});



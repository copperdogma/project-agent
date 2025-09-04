import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const md = `---\ntitle: Prev Doc\nslug: prev-doc\n---\n# Uncategorized\nSeed ^seed01\n# Notes\nLine A ^ancA01\n`;
  fs.writeFileSync(path.join(projectsDir, "Prev Doc.md"), md, "utf8");

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

  // Append preview should report would_change
  const ops = [{ type: "append", section: "Notes", text: "Preview line" }];
  const res1 = await call("project_preview", { slug: "prev-doc", opsJson: JSON.stringify(ops) });
  if (!res1.ok || res1.would_change !== true) throw new Error("preview: expected would_change true");

  // Dedup append preview should show skipped
  const ops2 = [{ type: "append", section: "Uncategorized", text: "Seed" }];
  const res2 = await call("project_preview", { slug: "prev-doc", opsJson: JSON.stringify(ops2) });
  if (!res2.ok || !res2.notes.some((n) => n.startsWith("append_skipped_dedup:"))) throw new Error("preview: expected dedup note");

  // Invalid opsJson
  const res3 = await call("project_preview", { slug: "prev-doc", opsJson: "not-json" });
  if (!res3.error || res3.error.code !== "VALIDATION_ERROR") throw new Error("preview: expected VALIDATION_ERROR for bad JSON");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: preview tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("preview tests failed", err);
  process.exit(1);
});



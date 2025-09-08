import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Create a file whose title includes spaces, a hyphen surrounded by spaces, and a plus sign
  const filename = "Skulls - Matter+Battery Update.md";
  const content = [
    "# Notes",
    "Seed line ^seed01",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(projectsDir, filename), content, "utf8");

  // Wire up tool handlers by registering on a stub MCP server
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

  // The derived slug for this title should retain '+', and collapse spaces around '-' → "skulls-matter+battery-update"
  const slug = "skulls-matter+battery-update";

  // Read path via snapshot to verify the reader side resolves it
  const snap = await call("project_snapshot", { slug });
  if (snap.error) throw new Error(`snapshot failed: ${JSON.stringify(snap)}`);
  if (!snap.path || !snap.toc) throw new Error("snapshot payload missing path/toc");

  // Also ensure get_document resolves the same slug consistently
  const doc = await call("project_get_document", { slug, suppressContent: true });
  if (doc.error) throw new Error(`get_document failed: ${JSON.stringify(doc)}`);
  if (!doc.path || typeof doc.size_bytes !== "number") throw new Error("get_document payload missing fields");

  // Append to existing section should succeed (previously failed with NOT_FOUND)
  const appendRes = await call("project_append", { slug, section: "Notes", text: "New decorated skull idea" });
  if (appendRes?.error) throw new Error(`append returned error: ${JSON.stringify(appendRes)}`);
  if (!Array.isArray(appendRes?.summary) || !appendRes.summary.some((s) => s.startsWith("append:"))) {
    throw new Error(`append summary missing: ${JSON.stringify(appendRes)}`);
  }

  // Preview should also resolve and report would_change false for immediate replay (dedup may not trigger),
  // but at least it must not be NOT_FOUND.
  const ops = [{ type: "append", section: "Notes", text: "Another idea" }];
  const previewRes = await call("project_preview", { slug, opsJson: JSON.stringify(ops) });
  if (previewRes?.error) throw new Error(`preview returned error: ${JSON.stringify(previewRes)}`);
  if (typeof previewRes?.ok !== "boolean") throw new Error("preview missing ok flag");

  // Also accept URL-encoded slug variant (e.g., + → %2B)
  const encodedSlug = "skulls-matter%2Bbattery-update";
  const appendEncoded = await call("project_append", { slug: encodedSlug, section: "Notes", text: "Encoded slug write" });
  if (appendEncoded?.error) throw new Error(`append (encoded) error: ${JSON.stringify(appendEncoded)}`);

  // And mixed-case slug should still resolve (normalized)
  const mixedCase = "Skulls-Matter+Battery-Update";
  const previewMixed = await call("project_preview", { slug: mixedCase, opsJson: JSON.stringify([{ type: "append", section: "Notes", text: "Mixed" }]) });
  if (previewMixed?.error) throw new Error(`preview (mixed case) error: ${JSON.stringify(previewMixed)}`);

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: slug resolution write/read consistency");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("slug resolution test failed", err);
  process.exit(1);
});

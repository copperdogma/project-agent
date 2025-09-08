import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";

  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const md = [
    "Intro link", "", "## Random Notes", "Line ^a1", "", "## Notes", "Line ^b2", "",
  ].join("\n");
  fs.writeFileSync(path.join(projectsDir, "Skulls - Matter+Battery Update.md"), md, "utf8");

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

  const slug = "skulls-matter+battery-update";
  const snap1 = await call("project_snapshot", { slug });
  if (snap1.error) throw new Error(`snapshot failed pre: ${JSON.stringify(snap1)}`);
  if (snap1.toc[0] === "TODO NEXT") throw new Error("unexpected existing section");

  const cs = await call("project_create_section", { slug, name: "TODO NEXT" });
  if (cs?.error) throw new Error(`create_section error: ${JSON.stringify(cs)}`);
  if (cs.created !== true) throw new Error("expected created=true");

  const snap2 = await call("project_snapshot", { slug });
  if (snap2.error) throw new Error(`snapshot failed post: ${JSON.stringify(snap2)}`);
  if (snap2.toc[0] !== "TODO NEXT") throw new Error(`expected TODO NEXT first, got ${snap2.toc[0]}`);

  const append = await call("project_append", { slug, section: "TODO NEXT", text: "Add video" });
  if (append?.error) throw new Error(`append after create_section failed: ${JSON.stringify(append)}`);

  // idempotent second call
  const cs2 = await call("project_create_section", { slug, name: "TODO NEXT" });
  if (cs2?.error) throw new Error(`create_section second call error: ${JSON.stringify(cs2)}`);
  if (cs2.created !== false) throw new Error("expected created=false on second call");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: create_section top + append");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("create-section test failed", err);
  process.exit(1);
});


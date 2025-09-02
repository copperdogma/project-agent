import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const file = "Gadget Light.md";
  const md = `# Gadget Light\nA small gadget with LED.\n\n## Build\n- Cut slot ^b1b1b1\n- Solder LED\n\n## Issues\n- Heat damaged first LED\n`;
  fs.writeFileSync(path.join(projectsDir, file), md, "utf8");

  const { listProjects } = await import(new URL("../dist/list.js", import.meta.url));
  const { buildSnapshot } = await import(new URL("../dist/snapshot.js", import.meta.url));

  const items = listProjects();
  const target = items.find((x) => x.path.endsWith(file));
  if (!target) throw new Error("integration snapshot: seeded doc not listed");

  const snap = await buildSnapshot(target.slug);
  if (!Array.isArray(snap.toc) || snap.toc.length < 2) throw new Error("integration snapshot: toc not populated");
  if (!snap.per_section_tail.Build || snap.per_section_tail.Build.length === 0) throw new Error("integration snapshot: Build tail missing");
  if (!snap.per_section_tail.Issues) throw new Error("integration snapshot: Issues tail missing");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: integration snapshot structured doc passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("integration snapshot test failed", err);
  process.exit(1);
});

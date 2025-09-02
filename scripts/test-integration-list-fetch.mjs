import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Seed multiple docs with various slug/title forms
  const seeds = [
    { file: "LED D&D Miniature.md", md: `---\ntitle: LED D&D Miniature\nslug: led-d&d-miniature\n---\n# U\nhello\n` },
    { file: "Skulls+++ --- Plan.md", md: `---\ntitle: Skulls+++ --- Plan\n---\n# U\nhello\n` },
    { file: "AI Router.md", md: `# U\nhello\n` },
  ];
  for (const s of seeds) {
    fs.writeFileSync(path.join(projectsDir, s.file), s.md, "utf8");
  }

  const listMod = await import(new URL("../dist/list.js", import.meta.url));
  const docMod = await import(new URL("../dist/document.js", import.meta.url));
  const snapMod = await import(new URL("../dist/snapshot.js", import.meta.url));

  const projects = listMod.listProjects();
  if (!Array.isArray(projects) || projects.length < seeds.length) {
    throw new Error("integration: list returned fewer projects than expected");
  }

  for (const p of projects) {
    const d = await docMod.getDocument(p.slug);
    if (!d.content) throw new Error(`integration: getDocument missing content for ${p.slug}`);
    const s = await snapMod.buildSnapshot(p.slug);
    if (!s.frontmatter) throw new Error(`integration: snapshot missing frontmatter for ${p.slug}`);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: integration list→getDocument/snapshot passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("integration test failed", err);
  process.exit(1);
});

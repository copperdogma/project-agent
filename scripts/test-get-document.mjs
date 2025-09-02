import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const docs = [
    {
      file: "LED D&D Miniature.md",
      md: `---\ntitle: LED D&D Miniature\nslug: led-d&d-miniature\n---\n# U\nhello\n`,
      slug: "led-d&d-miniature",
    },
    {
      file: "Skulls+++ --- Plan.md",
      md: `---\ntitle: Skulls+++ --- Plan\n---\n# U\nhello\n`,
      slug: "skulls+++---plan",
    },
    {
      file: "AI Router.md",
      md: `# U\nhello\n`,
      slug: "ai-router", // derived from filename
    },
  ];

  for (const d of docs) {
    fs.writeFileSync(path.join(projectsDir, d.file), d.md, "utf8");
  }

  const { getDocument } = await import(new URL("../dist/document.js", import.meta.url));

  for (const d of docs) {
    const res = await getDocument(d.slug);
    if (!res.content.includes("hello")) throw new Error(`content missing for ${d.slug}`);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: getDocument special slug tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("getDocument tests failed", err);
  process.exit(1);
});

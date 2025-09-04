import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Seed a doc with CRLF and without trailing newline
  const file = "Format Mix.md";
  const seed = `---\r\ntitle: Format Mix\r\nslug: format-mix\r\n---\r\n# Uncategorized\r\nLine A ^ancA01\r\n# Notes\r\nLine B ^ancB01`;
  // Note: no trailing EOL
  fs.writeFileSync(path.join(projectsDir, file), seed, "utf8");

  const { applyOps } = await import(new URL("../dist/apply.js", import.meta.url));
  const { getDocument } = await import(new URL("../dist/document.js", import.meta.url));

  // Append in Notes to ensure new line uses date prefix but preserves CRLF
  await applyOps({
    slug: "format-mix",
    ops: [{ type: "append", section: "Notes", text: "Added note" }],
  });

  const after = await getDocument("format-mix");
  const content = after.content;

  // Ensure CRLF is preserved somewhere after write
  if (!/\r\n/.test(content)) {
    throw new Error("formatting: expected CRLF to be preserved");
  }

  // Ensure the appended line has YYYYMMDD prefix
  const notesSection = content.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const appended = notesSection.find((l) => /\bai: Added note\b/.test(l));
  if (!appended) throw new Error("formatting: appended line not found");
  if (!/^\d{8} ai: /.test(appended)) throw new Error("formatting: date prefix not in YYYYMMDD");

  // Long line handling: update existing anchor with very long text
  const veryLong = "X".repeat(5000);
  await applyOps({
    slug: "format-mix",
    ops: [{ type: "update_by_anchor", anchor: "^ancA01", new_text: veryLong }],
  });

  const after2 = await getDocument("format-mix");
  const hasLong = /ai: X{100,} \^ancA01/.test(after2.content.replace(/\r\n/g, "\n"));
  if (!hasLong) throw new Error("formatting: long line update not applied correctly");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: formatting tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("formatting tests failed", err);
  process.exit(1);
});



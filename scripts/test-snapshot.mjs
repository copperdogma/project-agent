import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const cases = [
    {
      name: "basic with anchors and three sections",
      file: "Test Doc.md",
      md: `---\ntitle: Test Doc\nslug: test-doc\n---\n# Uncategorized\n20250101 ai: Hello world ^u123ab\n# Notes\nA line ^nabc123\nAnother line\n# Resources\n- Item — https://example.com 20250101 ai: ^r00a0b\n`,
      slug: "test-doc",
      expect: (snap) => {
        if (!snap.anchors_index["^u123ab"]) throw new Error("missing ^u123ab");
        if (!snap.toc.includes("Uncategorized")) throw new Error("toc missing Uncategorized");
      },
    },
    {
      name: "frontmatter quoted values",
      file: "Quoted.md",
      md: `---\ntitle: "Quoted Title"\nslug: "quoted"\n---\n# Uncategorized\n20250101 ai: Q ^q111aa\n`,
      slug: "quoted",
      expect: (snap) => {
        if (snap.frontmatter.title !== "Quoted Title") throw new Error("title not unquoted");
      },
    },
    {
      name: "missing frontmatter slug, fallback by filename",
      file: "fallback.md",
      md: `# Uncategorized\n20250101 ai: Fallback ^f11111\n`,
      slug: "fallback",
      expect: (snap) => {
        if (!snap.path.endsWith("fallback.md")) throw new Error("fallback path incorrect");
      },
    },
    {
      name: "anchors with -b suffix",
      file: "Collide.md",
      md: `---\ntitle: Collide\nslug: collide\n---\n# Notes\nLine ^abc123\nAnother ^abc123-b\n`,
      slug: "collide",
      expect: (snap) => {
        if (!snap.anchors_index["^abc123-b"]) throw new Error("missing -b suffix anchor");
      },
    },
    {
      name: "long lines trimmed in excerpts",
      file: "Long.md",
      md: `---\ntitle: Long\nslug: long\n---\n# Notes\n${"x".repeat(300)} ^long01\n`,
      slug: "long",
      expect: (snap) => {
        const ex = snap.anchors_index["^long01"].excerpt;
        if (ex.length > 170) throw new Error("excerpt not trimmed");
      },
    },
    {
      name: "non-ASCII headings and robust parsing",
      file: "Unicode.md",
      md: `---\ntitle: 样例\nslug: unicode\n---\n# Идеи\nстрока ^u0000a\n`,
      slug: "unicode",
      expect: (snap) => {
        if (!snap.toc.includes("Идеи")) throw new Error("unicode heading missing");
      },
    },
  ];

  const { buildSnapshot } = await import(new URL("../dist/snapshot.js", import.meta.url));

  for (const c of cases) {
    const p = path.join(projectsDir, c.file);
    fs.writeFileSync(p, c.md, "utf8");
    const snap = await buildSnapshot(c.slug);
    // shared expectations
    if (!snap.date_local || !/^\d{8}$/.test(snap.date_local)) throw new Error(`${c.name}: invalid date_local`);
    if (!snap.tz) throw new Error(`${c.name}: tz missing`);
    if (!Array.isArray(snap.toc)) throw new Error(`${c.name}: toc missing`);
    // case-specific expectations
    c.expect(snap);
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: snapshot tests (variants) passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("snapshot tests failed", err);
  process.exit(1);
});

import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Seed with lines missing proper date/anchor
  const md = `---\ntitle: Anchor Rules\nslug: anchor-rules\n---\n# Uncategorized\n20250101 ai: ok ^abc123\ninvalid ai: missing date ^bad\nai: no date or anchor\n# Notes\n20250101 ai: fine ^abc123-b\n`;
  fs.writeFileSync(path.join(projectsDir, "Anchor Rules.md"), md, "utf8");

  const { buildSnapshot } = await import(new URL("../dist/snapshot.js", import.meta.url));
  const snap = await buildSnapshot("anchor-rules");
  if (!snap || typeof snap !== "object") throw new Error("anchors: snapshot missing");
  // Expect warnings for bad date prefix and possibly bad/missing anchor
  const wrn = snap.warnings || [];
  const hasBadDate = wrn.some((w) => /^bad_date_prefix:/.test(w));
  const hasMissingAnchor = wrn.some((w) => /^missing_anchor:/.test(w));
  if (!hasBadDate) throw new Error("anchors: expected bad_date_prefix warning");
  if (!hasMissingAnchor) throw new Error("anchors: expected missing_anchor warning");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: anchors validation warnings test passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("anchors validation test failed", err);
  process.exit(1);
});



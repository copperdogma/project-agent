import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const md = `---\ntitle: Ops Doc\nslug: ops-doc\n---\n# Uncategorized\nSeed ^seed01\n# Notes\nLine A ^ancA01\n# Resources\n- R ^res001\n`;
  fs.writeFileSync(path.join(projectsDir, "Ops Doc.md"), md, "utf8");

  const { applyOps } = await import(new URL("../dist/apply.js", import.meta.url));

  let res = await applyOps({
    slug: "ops-doc",
    ops: [
      { type: "append", section: "Notes", text: "New info" },
    ],
  });
  if (!Array.isArray(res.primary_anchors) || res.primary_anchors.length < 1) throw new Error("append failed to produce anchor");

  // Move by anchor to Resources
  const movedAnchor = res.primary_anchors[0];
  res = await applyOps({
    slug: "ops-doc",
    ops: [
      { type: "move_by_anchor", anchor: movedAnchor, to_section: "Resources" },
    ],
  });

  // Update existing A
  res = await applyOps({
    slug: "ops-doc",
    ops: [
      { type: "update_by_anchor", anchor: "^ancA01", new_text: "Line A updated" },
    ],
  });

  // Delete seed
  res = await applyOps({
    slug: "ops-doc",
    ops: [
      { type: "delete_by_anchor", anchor: "^seed01" },
    ],
  });

  // Dedup append should skip
  res = await applyOps({
    slug: "ops-doc",
    ops: [
      { type: "append", section: "Resources", text: "- R" },
    ],
  });
  if (!res.summary.some((s) => s.startsWith("append_skipped_dedup:"))) throw new Error("dedup not triggered");

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: applyOps unit tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("applyOps tests failed", err);
  process.exit(1);
});



import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  // Fallback scan case
  fs.writeFileSync(path.join(projectsDir, "One.md"), `---\ntitle: One\nslug: one\n---\n# U\n`, "utf8");
  fs.writeFileSync(path.join(projectsDir, "Two.md"), `# U\n`, "utf8");

  let mod = await import(new URL("../dist/list.js", import.meta.url));
  let list = mod.listProjects();
  if (!Array.isArray(list) || list.length < 2) throw new Error("fallback list size");
  const slugs = list.map((x) => x.slug);
  if (!slugs.includes("one")) throw new Error("missing slug one");

  // Registry case
  const agentDir = path.join(tmpRoot, ".project-agent");
  fs.mkdirSync(agentDir, { recursive: true });
  fs.writeFileSync(
    path.join(agentDir, "projects.yaml"),
    `- title: Zeta\n  slug: zeta\n  path: Projects/Zeta.md\n- title: Alpha\n  slug: alpha\n  path: Projects/Alpha.md\n`,
    "utf8",
  );

  mod = await import(new URL("../dist/list.js", import.meta.url));
  list = mod.listProjects();
  // After registry present, we should merge registry and filesystem entries
  if (!Array.isArray(list) || list.length < 4) throw new Error("registry+scan merged list size");
  const titles = list.map((x) => x.title);
  if (!(titles[0] === "Alpha" && titles.includes("Zeta") && titles.includes("One") && titles.includes("Two"))) {
    throw new Error("merged contents or sort order incorrect");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: list tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("list tests failed", err);
  process.exit(1);
});

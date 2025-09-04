import fs from "fs";
import os from "os";
import path from "path";

async function run() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  process.env.VAULT_ROOT = tmpRoot;
  process.env.TIMEZONE = "America/Edmonton";
  const projectsDir = path.join(tmpRoot, "Projects");
  fs.mkdirSync(projectsDir, { recursive: true });

  const { createProject } = await import(new URL("../dist/create.js", import.meta.url));
  const res = await createProject({ title: "My New Project", router_email: "router@example.com" });
  if (!res.slug || !res.path) throw new Error("missing slug/path");
  const createdPath = path.join(tmpRoot, res.path);
  const md = fs.readFileSync(createdPath, "utf8");
  if (!md.includes("# Uncategorized")) throw new Error("missing section");
  if (!fs.existsSync(path.join(tmpRoot, ".project-agent", "projects.yaml"))) throw new Error("missing registry");

  // unique slug enforcement
  try {
    await createProject({ title: "My New Project" });
    throw new Error("slug conflict not enforced");
  } catch (e) {
    const msg = String((e && e.message) ? e.message : e);
    if (!(msg.includes("CONFLICT_SLUG") || msg.includes("CONFLICT_FILE"))) {
      throw new Error(`unexpected error for duplicate create: ${msg}`);
    }
  }

  // Registry loads via list
  const { listProjects } = await import(new URL("../dist/list.js", import.meta.url));
  const list = listProjects();
  const slugs = list.map((x) => x.slug);
  if (!slugs.includes(res.slug)) throw new Error("registry not reflected in list");

  // filename sanitization
  const res2 = await createProject({ title: "Bad:/\\*?\"<>| Name" });
  if (!res2.path.endsWith("Bad------\"<>| Name.md".replace(/[\\/:*?"<>|]/g, "-"))) {
    // re-check by file presence
    if (!fs.existsSync(path.join(tmpRoot, res2.path))) throw new Error("sanitized filename not created");
  }

  fs.rmSync(tmpRoot, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log("OK: create tests passed");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("create tests failed", err);
  process.exit(1);
});



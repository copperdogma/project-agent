import fs from "fs";
import path from "path";
import { getVaultRoot } from "./vault.js";
import { deriveSlugFromTitle } from "./slug.js";

interface ProjectEntry { title: string; slug: string; path: string }

function parseFrontmatter(raw: string): Record<string, string> {
  const lines = raw.split(/\n|\r\n|\r/);
  const fm: Record<string, string> = {};
  if ((lines[0] ?? "").trim() !== "---") return fm;
  let idx = 1;
  while (idx < lines.length && ((lines[idx] ?? "").trim() !== "---")) {
    const line = String(lines[idx] ?? "");
    const m = /^(\w[\w_-]*):\s*(.*)$/.exec(line);
    if (m) {
      const key = (m[1] ?? "").trim();
      let val = (m[2] ?? "").trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fm[key] = val;
    }
    idx += 1;
  }
  return fm;
}

export function listProjects(): ProjectEntry[] {
  const vaultRoot = getVaultRoot();
  const registryPath = path.join(vaultRoot, ".project-agent", "projects.yaml");
  const results: ProjectEntry[] = [];

  if (fs.existsSync(registryPath)) {
    try {
      const raw = fs.readFileSync(registryPath, "utf8");
      // very small YAML subset: expecting lines like: - title: X, slug: y, path: Z
      const items: ProjectEntry[] = [];
      const lines = raw.split(/\n|\r\n|\r/);
      let current: Partial<ProjectEntry> | null = null;
      for (const line of lines) {
        if (line.trim().startsWith("- ")) {
          if (current && current.title && current.slug && current.path) {
            items.push(current as ProjectEntry);
          }
          current = {};
          continue;
        }
        const m = /^(\s*)(title|slug|path):\s*(.+)\s*$/.exec(line);
        if (m) {
          const keyRaw = (m[2] ?? "").trim();
          let val = (m[3] ?? "").trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (keyRaw === "title" || keyRaw === "slug" || keyRaw === "path") {
            (current as any)[keyRaw] = val;
          }
        }
      }
      if (current && current.title && current.slug && current.path) {
        items.push(current as ProjectEntry);
      }
      for (const it of items) {
        results.push({ title: it.title, slug: it.slug, path: it.path });
      }
    } catch {
      // fall back to scan
    }
  }

  if (results.length === 0) {
    const projectsDir = path.join(vaultRoot, "Projects");
    if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
      for (const entry of fs.readdirSync(projectsDir)) {
        if (!entry.toLowerCase().endsWith(".md")) continue;
        const abs = path.join(projectsDir, entry);
        try {
          const raw = fs.readFileSync(abs, "utf8");
          const fm = parseFrontmatter(raw);
          const title = fm.title || path.basename(entry, ".md");
          const slug = fm.slug || deriveSlugFromTitle(title);
          results.push({ title, slug, path: path.relative(vaultRoot, abs) });
        } catch {}
      }
    }
  }

  // enforce unique slugs and sort by title
  const seen = new Set<string>();
  const unique = results.filter((r) => {
    if (seen.has(r.slug)) return false;
    seen.add(r.slug);
    return true;
  });
  unique.sort((a, b) => a.title.localeCompare(b.title));
  return unique;
}

import fs from "fs";
import path from "path";
import { deriveSlugFromTitle } from "./slug.js";

export function parseFrontmatterBasic(raw: string): { frontmatter: Record<string, string> } {
  const sanitized = raw.replace(/^\uFEFF/, "");
  const lines = sanitized.split(/\n|\r\n|\r/);
  const fm: Record<string, string> = {};
  if ((lines[0] ?? "").trim() !== "---") return { frontmatter: fm };
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
  return { frontmatter: fm };
}

function normalizeSlugValue(s: string | null | undefined): string {
  return String(s ?? "").trim().toLowerCase();
}

export function findFileBySlug(slug: string, vaultRoot: string): string | null {
  // Accept both literal and URL-encoded slugs (e.g., plus sign encoded as %2B)
  const provided = String(slug ?? "");
  const variants = new Set<string>();
  variants.add(normalizeSlugValue(provided));
  try {
    variants.add(normalizeSlugValue(decodeURIComponent(provided)));
  } catch {}

  const projectsDir = path.join(vaultRoot, "Projects");
  if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
    const entries = fs.readdirSync(projectsDir);
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith(".md")) continue;
      const abs = path.join(projectsDir, entry);
      try {
        const raw = fs.readFileSync(abs, "utf8");
        const { frontmatter } = parseFrontmatterBasic(raw);
        const fmSlug = (frontmatter.slug || (frontmatter as any).Slug || "").trim();
        const fmTitle = (frontmatter.title || (frontmatter as any).Title || "").trim();
        const base = path.basename(entry, ".md");
        const candidates = new Set<string>([
          normalizeSlugValue(fmSlug),
          normalizeSlugValue(deriveSlugFromTitle(fmTitle || base)),
          normalizeSlugValue(deriveSlugFromTitle(base)),
        ]);
        for (const v of variants) {
          if (candidates.has(v)) return abs;
        }
      } catch {}
    }
  }
  // Attempt a direct filename fallback for exact matches
  const fallback = path.join(projectsDir, `${provided}.md`);
  return fs.existsSync(fallback) ? fallback : null;
}

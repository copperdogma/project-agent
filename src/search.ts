import fs from "fs";
import path from "path";
import { getVaultRoot } from "./vault.js";
import { deriveSlugFromTitle } from "./slug.js";

export interface SearchMatch { section: string; anchor?: string; excerpt: string }
export interface SearchResponse { matches: SearchMatch[] }

function parseFrontmatter(raw: string): { contentStart: number; frontmatter: Record<string, string> } {
  const sanitized = raw.replace(/^\uFEFF/, "");
  const lines = sanitized.split(/\n|\r\n|\r/);
  let idx = 0;
  const fm: Record<string, string> = {};
  if ((lines[0] ?? "").trim() === "---") {
    idx = 1;
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
    if (((lines[idx] ?? "").trim() === "---")) idx += 1;
  }
  return { contentStart: idx, frontmatter: fm };
}

function findFileBySlug(slug: string, vaultRoot: string): string | null {
  const projectsDir = path.join(vaultRoot, "Projects");
  if (fs.existsSync(projectsDir) && fs.statSync(projectsDir).isDirectory()) {
    const entries = fs.readdirSync(projectsDir);
    for (const entry of entries) {
      if (!entry.toLowerCase().endsWith(".md")) continue;
      const abs = path.join(projectsDir, entry);
      try {
        const raw = fs.readFileSync(abs, "utf8");
        const { frontmatter } = parseFrontmatter(raw);
        const fmSlug = (frontmatter.slug || (frontmatter as any).Slug || "").trim();
        const fmTitle = (frontmatter.title || (frontmatter as any).Title || "").trim();
        const fileBase = path.basename(entry, ".md");
        const candidates = new Set<string>([
          fmSlug,
          deriveSlugFromTitle(fmTitle || fileBase),
          deriveSlugFromTitle(fileBase),
        ].filter(Boolean) as string[]);
        if (candidates.has(slug)) return abs;
      } catch {}
    }
  }
  const fallback = path.join(projectsDir, `${slug}.md`);
  return fs.existsSync(fallback) ? fallback : null;
}

function parseSectionsPreserveOrder(raw: string, startIndex: number): { toc: string[]; sections: Record<string, string[]> } {
  const lines = raw.replace(/^\uFEFF/, "").split(/\n|\r\n|\r/);
  const toc: string[] = [];
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = String(lines[i] ?? "");
    const heading = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line);
    if (heading) {
      const name = (heading[1] ?? "").trim();
      current = name;
      if (!toc.includes(name)) toc.push(name);
      if (!sections[name]) sections[name] = [];
      continue;
    }
    if (current) {
      if (!sections[current]) sections[current] = [];
      (sections[current] as string[]).push(line);
    }
  }
  return { toc, sections };
}

function buildExcerpt(line: string, query: string, maxChars: number): string {
  const idx = line.toLowerCase().indexOf(query.toLowerCase());
  if (line.length <= maxChars) return line;
  if (idx < 0) return line.slice(0, maxChars - 3) + "...";
  const half = Math.floor((maxChars - 3) / 2);
  const start = Math.max(0, idx - half);
  const end = Math.min(line.length, start + (maxChars - 3));
  const chunk = line.slice(start, end);
  return (start > 0 ? "..." : "") + chunk + (end < line.length ? "..." : "");
}

export async function searchInDocument(input: { slug: string; query: string; scope?: "all"|"section"; section?: string }): Promise<SearchResponse> {
  const slug = String(input.slug || "");
  const query = String(input.query || "").trim();
  const scope = (input.scope === "section" ? "section" : "all") as "all"|"section";
  const sectionName = String(input.section || "");
  if (!slug) throw new Error("VALIDATION_ERROR: missing slug");
  if (!query) throw new Error("VALIDATION_ERROR: missing query");
  if (scope === "section" && !sectionName) throw new Error("VALIDATION_ERROR: section is required when scope=section");

  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) throw new Error(`NOT_FOUND: No document found for slug ${slug}`);
  const raw = fs.readFileSync(fullPath, "utf8");
  const { contentStart } = parseFrontmatter(raw);
  const { toc, sections } = parseSectionsPreserveOrder(raw, contentStart);
  const maxResults = Number(process.env.SEARCH_MAX_RESULTS || 50);
  const excerptMax = Number(process.env.SEARCH_EXCERPT_MAX_CHARS || 160);

  const out: SearchMatch[] = [];
  const targetSections = scope === "section" ? [sectionName] : toc.slice();
  for (const sec of targetSections) {
    const lines = sections[sec] || [];
    for (const line of lines) {
      if (!line) continue;
      if (line.toLowerCase().includes(query.toLowerCase())) {
        const m = /\^([a-z0-9]{6,8}(?:-b)?)/i.exec(line);
        const anchorVal = m ? `^${m[1]}` : undefined;
        const excerpt = buildExcerpt(line, query, excerptMax);
        const match: any = { section: sec, excerpt };
        if (anchorVal !== undefined) match.anchor = anchorVal;
        out.push(match as SearchMatch);
        if (out.length >= maxResults) return { matches: out };
      }
    }
  }
  return { matches: out };
}



import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, findGitRoot } from "./vault.js";
import { deriveSlugFromTitle } from "./slug.js";

export interface SnapshotPayload {
  frontmatter: Record<string, string>;
  toc: string[];
  per_section_tail: Record<string, string[]>;
  anchors_index: Record<string, { section: string; excerpt: string }>;
  recent_ops: string[];
  current_commit: string | null;
  date_local: string;
  tz: string;
  path: string;
  size_bytes: number;
}

function formatDateYYYYMMDD(timezone: string): string {
  const dt = new Date();
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
  const parts = formatted.split(/[^0-9]/).filter(Boolean);
  const year = parts[0] || "0000";
  const month = parts[1] || "00";
  const day = parts[2] || "00";
  return `${year}${month}${day}`;
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; contentStart: number } {
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
    // Skip closing ---
    if (((lines[idx] ?? "").trim() === "---")) idx += 1;
  }
  return { frontmatter: fm, contentStart: idx };
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
        if (candidates.has(slug)) {
          return abs;
        }
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
      const currentSectionLines = sections[current] as string[];
      currentSectionLines.push(line);
    }
  }
  return { toc, sections };
}

function buildAnchorsIndex(sections: Record<string, string[]>): Record<string, { section: string; excerpt: string }> {
  const idx: Record<string, { section: string; excerpt: string }> = {};
  const anchorRegex = /\^([a-z0-9]{6,8}(?:-b)?)/i;
  for (const [section, lines] of Object.entries(sections)) {
    for (const line of lines) {
      const m = anchorRegex.exec(line);
      if (m) {
        const id = `^${m[1]}`;
        const excerpt = line.length > 160 ? `${line.slice(0, 157)}...` : line;
        idx[id] = { section, excerpt };
      }
    }
  }
  return idx;
}

function tailsFromSections(sections: Record<string, string[]>, tail: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [section, lines] of Object.entries(sections)) {
    const filtered = lines.slice();
    const tailLines = filtered.slice(Math.max(0, filtered.length - tail));
    out[section] = tailLines;
  }
  return out;
}

async function readCurrentCommit(vaultRoot: string): Promise<string | null> {
  try {
    const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
    if (!fs.existsSync(path.join(repoRoot, ".git"))) return null;
    const git = simpleGit({ baseDir: repoRoot });
    const rev = await git.revparse(["HEAD"]);
    return (rev || "").trim() || null;
  } catch {
    return null;
  }
}

export async function buildSnapshot(slug: string): Promise<SnapshotPayload> {
  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) {
    throw new Error(`NOT_FOUND: No document found for slug ${slug}`);
  }
  const raw = fs.readFileSync(fullPath, "utf8");
  const stat = fs.statSync(fullPath);
  const { frontmatter, contentStart } = parseFrontmatter(raw);
  const { toc, sections } = parseSectionsPreserveOrder(raw, contentStart);

  const tailSize = Number(process.env.SNAPSHOT_TAIL || 10);
  const per_section_tail = tailsFromSections(sections, tailSize);
  const anchors_index = buildAnchorsIndex(sections);
  const tz = process.env.TIMEZONE || "America/Edmonton";
  const date_local = formatDateYYYYMMDD(tz);
  const current_commit = await readCurrentCommit(vaultRoot);

  return {
    frontmatter,
    toc,
    per_section_tail,
    anchors_index,
    recent_ops: [],
    current_commit,
    date_local,
    tz,
    path: path.relative(vaultRoot, fullPath),
    size_bytes: stat.size,
  };
}

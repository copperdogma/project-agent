import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, readFileSafely, findGitRoot } from "./vault.js";
import { deriveSlugFromTitle } from "./slug.js";

function parseFrontmatter(raw: string): { frontmatter: Record<string, string>; contentStart: number } {
  const lines = raw.split(/\n|\r\n|\r/);
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
        const candidates = [
          fmSlug,
          deriveSlugFromTitle(fmTitle || fileBase),
          deriveSlugFromTitle(fileBase),
        ].filter(Boolean) as string[];
        const slugNorm = String(slug || "").trim().toLowerCase();
        const match = candidates.some((c) => String(c).trim().toLowerCase() === slugNorm);
        if (match) {
          return abs;
        }
      } catch {}
    }
  }
  const fallback = path.join(projectsDir, `${slug}.md`);
  return fs.existsSync(fallback) ? fallback : null;
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

export interface GetDocumentResult {
  frontmatter: Record<string, string>;
  content: string;
  path: string;
  size_bytes: number;
  current_commit: string | null;
  date_local: string;
  tz: string;
}

export async function getDocument(slug: string): Promise<GetDocumentResult> {
  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) {
    throw new Error(`NOT_FOUND: No document found for slug ${slug}`);
  }
  const raw = readFileSafely(path.relative(vaultRoot, fullPath)).content;
  const stat = fs.statSync(fullPath);
  const { frontmatter } = parseFrontmatter(raw);
  const tz = process.env.TIMEZONE || "America/Edmonton";
  const date_local = formatDateYYYYMMDD(tz);
  const current_commit = await readCurrentCommit(vaultRoot);

  return {
    frontmatter,
    content: raw,
    path: path.relative(vaultRoot, fullPath),
    size_bytes: stat.size,
    current_commit,
    date_local,
    tz,
  };
}

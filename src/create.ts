import fs from "fs";
import path from "path";
import { getVaultRoot, writeFileSafely } from "./vault.js";
import { deriveSlugFromTitle } from "./slug.js";

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

export interface RegistryEntry { title: string; slug: string; path: string }

function registryPath(root: string): string {
  return path.join(root, ".project-agent", "projects.yaml");
}

function readRegistry(root: string): RegistryEntry[] {
  const p = registryPath(root);
  if (!fs.existsSync(p)) return [];
  try {
    const raw = fs.readFileSync(p, "utf8");
    const items: RegistryEntry[] = [];
    const lines = raw.split(/\n|\r\n|\r/);
    let current: Partial<RegistryEntry> | null = null;
    for (const line of lines) {
      if (line.trim().startsWith("- ")) {
        if (current && current.title && current.slug && current.path) {
          items.push(current as RegistryEntry);
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
      items.push(current as RegistryEntry);
    }
    return items;
  } catch {
    return [];
  }
}

function writeRegistry(root: string, entries: RegistryEntry[]): void {
  const out: string[] = [];
  for (const e of entries) {
    out.push(`- title: ${JSON.stringify(e.title)}`);
    out.push(`  slug: ${JSON.stringify(e.slug)}`);
    out.push(`  path: ${JSON.stringify(e.path)}`);
  }
  const p = registryPath(root);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, out.join("\n") + (out.length ? "\n" : ""), "utf8");
}

export interface CreateProjectInput {
  title: string;
  slug?: string;
  router_email?: string;
}

export interface CreateProjectResult {
  title: string;
  slug: string;
  path: string;
}

function sanitizeTitleForFilename(title: string): string {
  const trimmed = title.trim();
  // Replace characters that are unsafe in filenames across OSes
  const replaced = trimmed.replace(/[\\/\:\*\?"<>\|]/g, "-");
  // Collapse whitespace to single spaces
  const collapsed = replaced.replace(/\s+/g, " ");
  return collapsed;
}

export function createProject(input: CreateProjectInput): CreateProjectResult {
  const vaultRoot = getVaultRoot();
  const title = String(input.title || "").trim();
  if (!title) throw new Error("VALIDATION_ERROR: title required");
  const slug = String(input.slug || deriveSlugFromTitle(title));
  const projectsDir = path.join(vaultRoot, "Projects");
  const safeTitle = sanitizeTitleForFilename(title);
  const fileName = `${safeTitle}.md`;
  const relPath = path.join("Projects", fileName);
  const absPath = path.join(projectsDir, fileName);

  // Enforce unique slug
  const entries = readRegistry(vaultRoot);
  const slugTaken = entries.some((e) => e.slug === slug);
  if (slugTaken) throw new Error("CONFLICT_SLUG: slug already exists");
  if (fs.existsSync(absPath)) throw new Error("CONFLICT_FILE: file already exists");

  const tz = process.env.TIMEZONE || "America/Edmonton";
  const today = formatDateYYYYMMDD(tz);

  const fmLines = [
    "---",
    `title: ${JSON.stringify(title)}`,
    `slug: ${JSON.stringify(slug)}`,
    input.router_email ? `router_email: ${JSON.stringify(String(input.router_email))}` : undefined,
    "---",
  ].filter(Boolean) as string[];

  const body = [
    "# Uncategorized",
    `${today} ai: Project created`,
    "",
    "# Notes",
    "",
    "# Resources",
    "",
  ].join("\n");

  const data = [...fmLines, body].join("\n");
  writeFileSafely(relPath, data);

  const next = [...entries, { title, slug, path: relPath }];
  // Ensure unique slugs and stable sort by title
  const uniqueBySlug = new Map<string, RegistryEntry>();
  for (const e of next) {
    if (!uniqueBySlug.has(e.slug)) uniqueBySlug.set(e.slug, e);
  }
  const final = Array.from(uniqueBySlug.values());
  final.sort((a, b) => a.title.localeCompare(b.title));
  writeRegistry(vaultRoot, final);

  return { title, slug, path: relPath };
}



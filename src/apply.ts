import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, readFileSafely, writeFileSafely } from "./vault.js";

function parseFrontmatter(raw: string): { contentStart: number } {
  const lines = raw.replace(/^\uFEFF/, "").split(/\n|\r\n|\r/);
  let idx = 0;
  if ((lines[0] ?? "").trim() === "---") {
    idx = 1;
    while (idx < lines.length && ((lines[idx] ?? "").trim() !== "---")) {
      idx += 1;
    }
    if (((lines[idx] ?? "").trim() === "---")) idx += 1;
  }
  return { contentStart: idx };
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
        // very small frontmatter parse for slug/title fallback
        const fm = /\nslug:\s*(.*)\n/i.exec(raw);
        const title = /\ntitle:\s*(.*)\n/i.exec(raw);
        const base = path.basename(entry, ".md");
        const candidates = new Set<string>([
          String(fm?.[1] || "").replace(/^['"]|['"]$/g, "").trim(),
          base.replace(/\s+/g, "-").toLowerCase(),
          String(title?.[1] || base).replace(/^['"]|['"]$/g, "").trim().replace(/\s+/g, "-").toLowerCase(),
        ].filter(Boolean) as string[]);
        if (candidates.has(slug)) return abs;
      } catch {}
    }
  }
  const fallback = path.join(projectsDir, `${slug}.md`);
  return fs.existsSync(fallback) ? fallback : null;
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

function buildSectionMap(lines: string[], contentStart: number): Array<{ name: string; start: number; end: number }> {
  const sections: Array<{ name: string; start: number; end: number }> = [];
  let currentIndex: number | null = null;
  let currentName: string | null = null;
  for (let i = contentStart; i < lines.length; i += 1) {
    const line = String(lines[i] ?? "");
    const m = /^\s*#{1,6}\s+(.+?)\s*$/.exec(line);
    if (m) {
      if (currentIndex !== null && currentName) {
        sections.push({ name: currentName, start: currentIndex, end: i });
      }
      currentIndex = i + 1; // content starts after heading line
      currentName = (m[1] ?? "").trim();
    }
  }
  if (currentIndex !== null && currentName) {
    sections.push({ name: currentName, start: currentIndex, end: lines.length });
  }
  return sections;
}

function findSection(sections: Array<{ name: string; start: number; end: number }>, name: string) {
  return sections.find((s) => s.name === name) || null;
}

function containsAnchor(line: string, anchor: string): boolean {
  const re = new RegExp(`\\^${anchor.replace(/\^/, "")}\\b`);
  return re.test(line);
}

function extractAnchor(line: string): string | null {
  const m = /\^([a-z0-9]{6,8}(?:-b)?)/i.exec(line);
  return m ? `^${m[1]}` : null;
}

function stripAnchorsFromText(text: string): string {
  // Remove any inline anchor tokens provided by user input to avoid duplicates
  return text.replace(/\s*\^[a-z0-9]{6,8}(?:-b)?\b/gi, "").trimEnd();
}

function generateAnchor(existingText: string): string {
  const has = (id: string) => new RegExp(`\\^${id}(?:\\b|$)`, "i").test(existingText);
  let base = Math.random().toString(36).slice(2, 8).toLowerCase();
  if (base.length < 6) base = (base + "000000").slice(0, 6);
  let id = base;
  if (has(id)) id = `${base}-b`;
  return `^${id}`;
}

function normalizeForDedup(text: string): string {
  const t = text.trim().toLowerCase();
  const urlMatch = /(https?:\/\/[^\s)]+)\)?/i.exec(t);
  if (urlMatch) {
    let url = (urlMatch[1] as string).trim().toLowerCase();
    url = url.replace(/\/$/, "");
    return url;
  }
  return t;
}

function readCurrentCommit(vaultRoot: string): Promise<string | null> {
  try {
    if (!fs.existsSync(path.join(vaultRoot, ".git"))) return Promise.resolve(null);
    const git = simpleGit({ baseDir: vaultRoot });
    return git.revparse(["HEAD"]).then((rev) => (rev || "").trim() || null);
  } catch {
    return Promise.resolve(null);
  }
}

async function gitCommitAndDiff(vaultRoot: string, relativeFilePath: string, message: string): Promise<{ commit: string | null; diff: string }> {
  try {
    if (!fs.existsSync(path.join(vaultRoot, ".git"))) {
      return { commit: null, diff: "" };
    }
    const git = simpleGit({ baseDir: vaultRoot });
    await git.add([relativeFilePath]);
    const commitRes = await git.commit(message);
    const commit = String((commitRes as any).commit || "");
    let diff = "";
    if (commit) {
      try {
        // Show only this commit's changes for the file
        diff = await git.diff(["-U0", `${commit}^!`, "--", relativeFilePath]);
      } catch {
        // Fallback: full diff for the file
        diff = await git.show(["-U0", commit, "--", relativeFilePath]);
      }
    }
    return { commit, diff };
  } catch {
    return { commit: null, diff: "" };
  }
}

function idempotencyStorePath(root: string): string {
  return path.join(root, ".project-agent", "idempotency");
}

function readStoredCommitForKey(root: string, key: string): string | null {
  try {
    const p = path.join(idempotencyStorePath(root), `${key}.txt`);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim() || null;
    return null;
  } catch {
    return null;
  }
}

function writeStoredCommitForKey(root: string, key: string, commit: string | null): void {
  try {
    const dir = idempotencyStorePath(root);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, `${key}.txt`);
    fs.writeFileSync(p, String(commit || ""), "utf8");
  } catch {
    // best effort
  }
}

export type ApplyOp =
  | { type: "append"; section: string; text: string }
  | { type: "move_by_anchor"; anchor: string; to_section: string }
  | { type: "update_by_anchor"; anchor: string; new_text: string }
  | { type: "delete_by_anchor"; anchor: string };

export interface ApplyOpsInput {
  slug: string;
  ops: ApplyOp[];
  expected_commit?: string | null;
  idempotency_key?: string | null;
}

export interface ApplyOpsResult {
  commit: string | null;
  diff: string;
  summary: string[];
  primary_anchors: string[];
  current_commit: string | null;
}

export async function applyOps(input: ApplyOpsInput): Promise<ApplyOpsResult> {
  const { slug, ops, expected_commit, idempotency_key } = input;
  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) throw new Error(`NOT_FOUND: No document found for slug ${slug}`);

  // Idempotency short-circuit
  if (idempotency_key) {
    const prev = readStoredCommitForKey(vaultRoot, idempotency_key);
    if (prev) {
      const cur = await readCurrentCommit(vaultRoot);
      return {
        commit: prev,
        diff: "",
        summary: ["idempotent_replay"],
        primary_anchors: [],
        current_commit: cur,
      };
    }
  }

  const relPath = path.relative(vaultRoot, fullPath);
  const file = readFileSafely(relPath);
  const original = file.content;
  const lines = original.replace(/^\uFEFF/, "").split(/\n|\r\n|\r/);
  const { contentStart } = parseFrontmatter(original);
  const sections = buildSectionMap(lines, contentStart);
  const tz = process.env.TIMEZONE || "America/Edmonton";
  const today = formatDateYYYYMMDD(tz);
  const summary: string[] = [];
  const createdAnchors: string[] = [];

  const currentCommitBefore = await readCurrentCommit(vaultRoot);
  if (typeof expected_commit === "string" && expected_commit && expected_commit !== currentCommitBefore) {
    throw new Error("CONFLICT_EXPECTED_COMMIT: repository moved since expected_commit");
  }

  const fullTextForAnchorGen = lines.join("\n");

  const findLineIndexByAnchor = (anchor: string): number => {
    const id = anchor.startsWith("^") ? anchor : `^${anchor}`;
    for (let i = contentStart; i < lines.length; i += 1) {
      if (containsAnchor(lines[i] as string, id.replace(/^\^/, ""))) return i;
    }
    return -1;
  };

  const ensureSectionExists = (name: string) => {
    const s = findSection(sections, name);
    if (!s) throw new Error(`MISSING_SECTION: ${name}`);
    return s;
  };

  for (const op of ops) {
    if (op.type === "append") {
      const s = ensureSectionExists(op.section);
      // Dedup within section by normalized text or URL
      const sectionSlice = lines.slice(s.start, s.end);
      const normalizedNew = normalizeForDedup(op.text);
      const exists = sectionSlice.some((ln) => normalizeForDedup(ln.replace(/\s*\^[a-z0-9-]+$/i, "")) === normalizedNew);
      if (exists) {
        summary.push(`append_skipped_dedup:${op.section}`);
        continue;
      }
      const newAnchor = generateAnchor(fullTextForAnchorGen + lines.join("\n"));
      const cleaned = stripAnchorsFromText(op.text);
      const newLine = `${today} ai: ${cleaned} ${newAnchor}`.trimEnd();
      lines.splice(s.end, 0, newLine);
      // update section boundaries after insertion
      for (const sec of sections) {
        if (sec.start > s.end) {
          sec.start += 1;
          sec.end += 1;
        } else if (sec.end >= s.end) {
          sec.end += 1;
        }
      }
      createdAnchors.push(newAnchor);
      summary.push(`append:${op.section}`);
    } else if (op.type === "move_by_anchor") {
      const fromIdx = findLineIndexByAnchor(op.anchor);
      if (fromIdx < 0) throw new Error(`MISSING_ANCHOR: ${op.anchor}`);
      const s = ensureSectionExists(op.to_section);
      if (fromIdx < 0 || fromIdx >= lines.length) throw new Error("INTERNAL: anchor index out of range");
      const moved = lines.splice(fromIdx, 1)[0] as string;
      // fix sections boundaries around removal
      for (const sec of sections) {
        if (sec.start > fromIdx) {
          sec.start -= 1;
          sec.end -= 1;
        } else if (sec.end > fromIdx) {
          sec.end -= 1;
        }
      }
      lines.splice(s.end - (fromIdx < s.end ? 1 : 0), 0, moved);
      for (const sec of sections) {
        if (sec.start > s.end) {
          sec.start += 1;
          sec.end += 1;
        } else if (sec.end >= s.end) {
          sec.end += 1;
        }
      }
      const anc = extractAnchor(moved);
      if (anc) createdAnchors.push(anc);
      summary.push(`move:${op.anchor}->${op.to_section}`);
    } else if (op.type === "update_by_anchor") {
      const idx = findLineIndexByAnchor(op.anchor);
      if (idx < 0) throw new Error(`MISSING_ANCHOR: ${op.anchor}`);
      const old = lines[idx] as string;
      const anc = extractAnchor(old) || (op.anchor.startsWith("^") ? op.anchor : `^${op.anchor}`);
      const cleaned = stripAnchorsFromText(op.new_text);
      const newline = `${today} ai: ${cleaned} ${anc}`.trimEnd();
      lines[idx] = newline;
      createdAnchors.push(anc);
      summary.push(`update:${anc}`);
    } else if (op.type === "delete_by_anchor") {
      const idx = findLineIndexByAnchor(op.anchor);
      if (idx < 0) throw new Error(`MISSING_ANCHOR: ${op.anchor}`);
      const anc = extractAnchor(lines[idx] as string) || (op.anchor.startsWith("^") ? op.anchor : `^${op.anchor}`);
      lines.splice(idx, 1);
      for (const sec of sections) {
        if (sec.start > idx) {
          sec.start -= 1;
          sec.end -= 1;
        } else if (sec.end > idx) {
          sec.end -= 1;
        }
      }
      createdAnchors.push(anc);
      summary.push(`delete:${anc}`);
    } else {
      throw new Error("VALIDATION_ERROR: unknown op type");
    }
  }

  const updated = lines.join("\n");
  if (updated !== original) {
    writeFileSafely(relPath, updated, file.lineEnding);
  }

  const commitMsg = `applyOps(${slug}): ${summary.join(", ")}${idempotency_key ? `\n\nIdempotency-Key: ${idempotency_key}` : ""}`;
  const { commit, diff } = await gitCommitAndDiff(vaultRoot, relPath, commitMsg);

  if (idempotency_key) {
    writeStoredCommitForKey(vaultRoot, idempotency_key, commit);
  }

  const currentCommitAfter = await readCurrentCommit(vaultRoot);
  return {
    commit,
    diff,
    summary,
    primary_anchors: createdAnchors,
    current_commit: currentCommitAfter,
  };
}



import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, readFileSafely, writeFileSafely, findGitRoot } from "./vault.js";

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

async function waitForGitIndexLockClear(repoRoot: string, timeoutMs: number = 5000): Promise<boolean> {
  const lockPath = path.join(repoRoot, ".git", "index.lock");
  const started = Date.now();
  while (fs.existsSync(lockPath) && Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
  return !fs.existsSync(lockPath);
}

async function gitCommitAndDiff(repoRoot: string, filePathRelativeToRepo: string, message: string): Promise<{ commit: string | null; diff: string }> {
  try {
    if (!fs.existsSync(path.join(repoRoot, ".git"))) {
      // eslint-disable-next-line no-console
      console.warn("gitCommitAndDiff: no .git found", { repoRoot });
      return { commit: null, diff: "" };
    }
    const git = simpleGit({ baseDir: repoRoot });
    await waitForGitIndexLockClear(repoRoot, 5000);
    await git.add([filePathRelativeToRepo]);
    // Resolve author/committer from env with sane defaults
    const authorName = String(process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || "Project Agent").trim() || "Project Agent";
    const authorEmail = String(process.env.GIT_AUTHOR_EMAIL || process.env.GIT_COMMITTER_EMAIL || "robot@local").trim() || "robot@local";
    const committerName = String(process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || authorName).trim() || authorName;
    const committerEmail = String(process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || authorEmail).trim() || authorEmail;

    const rawCommitArgs = [
      "-c",
      `user.name=${committerName}`,
      "-c",
      `user.email=${committerEmail}`,
      "commit",
      "-m",
      message,
      "--author",
      `${authorName} <${authorEmail}>`,
    ];
    let commitHash: string | null = null;
    try {
      await git.raw(rawCommitArgs);
      commitHash = (await git.revparse(["HEAD"]))?.trim() || null;
    } catch (err: any) {
      if (String(err?.message || err).includes("index.lock")) {
        await waitForGitIndexLockClear(repoRoot, 3000);
        await git.raw(rawCommitArgs);
        commitHash = (await git.revparse(["HEAD"]))?.trim() || null;
      } else {
        throw err;
      }
    }
    const commit = String(commitHash || "");
    let diff = "";
    if (commit) {
      try {
        diff = await git.diff(["-U0", `${commit}^!`, "--", filePathRelativeToRepo]);
      } catch {
        // Fallback: full diff for the file
        diff = await git.show(["-U0", commit, "--", filePathRelativeToRepo]);
      }
    }
    // eslint-disable-next-line no-console
    console.info("gitCommitAndDiff: committed", { repoRoot, filePathRelativeToRepo, commit });
    return { commit, diff };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("gitCommitAndDiff: commit failed", { err: (err as any)?.message });
    return { commit: null, diff: "" };
  }
}

function idempotencyStorePath(root: string): string {
  return path.join(root, ".project-agent", "idempotency");
}

function sanitizeForFs(name: string): string {
  return String(name || "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getIdempotencyTtlSeconds(): number {
  const v = Number(process.env.IDEMPOTENCY_TTL_S ?? 3600);
  if (!Number.isFinite(v)) return 3600;
  return v;
}

type IdempotencyRecord = {
  commit: string | null;
  slug: string;
  created_at: string; // ISO8601
};

function readStoredCommitForKey(root: string, slug: string, key: string): string | null {
  try {
    const ttl = getIdempotencyTtlSeconds();
    if (ttl <= 0) return null; // TTL disabled → no replay

    const dir = path.join(idempotencyStorePath(root), sanitizeForFs(slug));
    const p = path.join(dir, `${sanitizeForFs(key)}.json`);
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        const rec = JSON.parse(raw) as IdempotencyRecord;
        if (!rec || typeof rec !== "object") return null;
        if (rec.slug !== slug) return null; // namespace isolation
        const created = Date.parse(rec.created_at || "");
        if (!Number.isFinite(created)) return null;
        const now = Date.now();
        if (now - created > ttl * 1000) {
          try { fs.unlinkSync(p); } catch {}
          return null;
        }
        return rec.commit || null;
      } catch {
        // fallthrough to legacy format
      }
    }

    // Legacy flat format: .txt under root dir without slug; no TTL info
    const legacy = path.join(idempotencyStorePath(root), `${sanitizeForFs(key)}.txt`);
    if (fs.existsSync(legacy)) {
      try {
        const commit = fs.readFileSync(legacy, "utf8").trim() || null;
        // Apply TTL based on file mtime as a rough bound
        const stat = fs.statSync(legacy);
        const ageMs = Date.now() - stat.mtimeMs;
        if (ageMs > ttl * 1000) return null;
        return commit;
      } catch {
        return null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredCommitForKey(root: string, slug: string, key: string, commit: string | null): void {
  try {
    const ttl = getIdempotencyTtlSeconds();
    if (ttl <= 0) return; // disabled → do not store

    const dir = path.join(idempotencyStorePath(root), sanitizeForFs(slug));
    fs.mkdirSync(dir, { recursive: true });
    // Ensure .project-agent/.gitignore exists to avoid dirty workdir from app files
    try {
      const ignoreFile = path.join(root, ".project-agent", ".gitignore");
      if (!fs.existsSync(ignoreFile)) {
        const contents = [
          "# Ignored app artifacts",
          "logs/",
          "idempotency/",
          "*.lock",
          "",
        ].join("\n");
        fs.writeFileSync(ignoreFile, contents, "utf8");
      }
    } catch {}
    const rec: IdempotencyRecord = { commit: commit || null, slug, created_at: new Date().toISOString() };
    const p = path.join(dir, `${sanitizeForFs(key)}.json`);
    fs.writeFileSync(p, JSON.stringify(rec), "utf8");
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
  const { slug, ops } = input;
  const expected_commit_raw: unknown = (input as any)?.expected_commit ?? null;
  const idempotency_key_raw: unknown = (input as any)?.idempotency_key ?? null;
  if (!(expected_commit_raw === null || typeof expected_commit_raw === "string" || expected_commit_raw === undefined)) {
    throw new Error("VALIDATION_ERROR: expected_commit must be a string or null");
  }
  if (!(idempotency_key_raw === null || typeof idempotency_key_raw === "string" || idempotency_key_raw === undefined)) {
    throw new Error("VALIDATION_ERROR: idempotency_key must be a string or null");
  }
  const expected_commit: string | null = (expected_commit_raw === undefined ? null : (expected_commit_raw as any)) ?? null;
  const idempotency_key: string | null = (idempotency_key_raw === undefined ? null : (idempotency_key_raw as any)) ?? null;
  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) throw new Error(`NOT_FOUND: No document found for slug ${slug}`);

  // Idempotency short-circuit (namespaced by slug + TTL)
  if (idempotency_key) {
    const prev = readStoredCommitForKey(vaultRoot, slug, idempotency_key);
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

  const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
  const filePathRelativeToRepo = path.relative(repoRoot, fullPath);
  const currentCommitBefore = await readCurrentCommit(repoRoot);
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
  const { commit, diff } = await gitCommitAndDiff(repoRoot, filePathRelativeToRepo, commitMsg);

  if (idempotency_key) {
    writeStoredCommitForKey(vaultRoot, slug, idempotency_key, commit);
  }

  const currentCommitAfter = await readCurrentCommit(repoRoot);
  return {
    commit,
    diff,
    summary,
    primary_anchors: createdAnchors,
    current_commit: currentCommitAfter,
  };
}



import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, readFileSafely, writeFileSafely, findGitRoot } from "./vault.js";
import { findFileBySlug } from "./resolve.js";
import { maybeAutoPush } from "./gitutil.js";

function parseFrontmatterContentStart(raw: string): number {
  const lines = raw.replace(/^\uFEFF/, "").split(/\n|\r\n|\r/);
  let idx = 0;
  if ((lines[0] ?? "").trim() === "---") {
    idx = 1;
    while (idx < lines.length && ((lines[idx] ?? "").trim() !== "---")) idx += 1;
    if (((lines[idx] ?? "").trim() === "---")) idx += 1;
  }
  return idx;
}

function findFirstHeadingIndex(lines: string[], startIndex: number): number {
  for (let i = startIndex; i < lines.length; i += 1) {
    if (/^\s*#{1,6}\s+/.test(String(lines[i] ?? ""))) return i;
  }
  return -1;
}

function sectionExists(lines: string[], startIndex: number, name: string): boolean {
  const rx = new RegExp(`^\\s*#{1,6}\\s+${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*$`);
  for (let i = startIndex; i < lines.length; i += 1) {
    if (rx.test(String(lines[i] ?? ""))) return true;
  }
  return false;
}

async function gitCommitAndDiff(repoRoot: string, fileRelative: string, message: string): Promise<{ commit: string | null; diff: string }> {
  try {
    if (!fs.existsSync(path.join(repoRoot, ".git"))) return { commit: null, diff: "" };
    const git = simpleGit({ baseDir: repoRoot });
    await git.add([fileRelative]);
    const authorName = String(process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || "Project Agent").trim() || "Project Agent";
    const authorEmail = String(process.env.GIT_AUTHOR_EMAIL || process.env.GIT_COMMITTER_EMAIL || "robot@local").trim() || "robot@local";
    const committerName = String(process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || authorName).trim() || authorName;
    const committerEmail = String(process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || authorEmail).trim() || authorEmail;
    await git.raw(["-c", `user.name=${committerName}`, "-c", `user.email=${committerEmail}`, "commit", "-m", message, "--author", `${authorName} <${authorEmail}>`]);
    const commit = (await git.revparse(["HEAD"]))?.trim() || null;
    let diff = "";
    if (commit) {
      try {
        diff = await git.diff(["-U0", `${commit}^!`, "--", fileRelative]);
      } catch {
        diff = await git.show(["-U0", commit, "--", fileRelative]);
      }
    }
    try { await maybeAutoPush(repoRoot); } catch {}
    return { commit, diff };
  } catch {
    return { commit: null, diff: "" };
  }
}

export interface EnsureSectionResult {
  created: boolean;
  commit: string | null;
  diff: string;
  current_commit: string | null;
}

export async function ensureSectionTop(slug: string, name: string): Promise<EnsureSectionResult> {
  const vaultRoot = getVaultRoot();
  const fullPath = findFileBySlug(slug, vaultRoot);
  if (!fullPath) throw new Error(`NOT_FOUND: No document found for slug ${slug}`);

  const relPath = path.relative(vaultRoot, fullPath);
  const file = readFileSafely(relPath);
  const original = file.content;
  const lines = original.replace(/^\uFEFF/, "").split(/\n|\r\n|\r/);
  const contentStart = parseFrontmatterContentStart(original);
  if (sectionExists(lines, contentStart, name)) {
    return { created: false, commit: null, diff: "", current_commit: null };
  }

  const firstHeadIdx = findFirstHeadingIndex(lines, contentStart);
  const insertAt = firstHeadIdx >= 0 ? firstHeadIdx : lines.length;
  const toInsert = [`## ${name}`, ""]; // blank line after heading
  lines.splice(insertAt, 0, ...toInsert);
  const updated = lines.join("\n");
  writeFileSafely(relPath, updated, file.lineEnding);

  const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
  const fileRelativeToRepo = path.relative(repoRoot, fullPath);
  const { commit, diff } = await gitCommitAndDiff(repoRoot, fileRelativeToRepo, `ensureSectionTop(${slug}): ${name}`);
  // Current commit equals commit above when repo present
  return { created: true, commit, diff, current_commit: commit };
}


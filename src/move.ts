import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, findGitRoot, readFileSafely, writeFileSafely } from "./vault.js";
import { findFileBySlug } from "./resolve.js";
import { deriveSlugFromTitle } from "./slug.js";
import { maybeAutoPush } from "./gitutil.js";
import { getProjectRoots } from "./roots.js";

export interface MoveDocumentInput {
  slug: string;
  toFolder: string;
  newTitle?: string;
  keepSlug?: boolean;
}

export interface MoveDocumentResult {
  oldPath: string;
  newPath: string;
  commit: string | null;
  diff: string;
  current_commit: string | null;
}

function sanitizeTitleForFilename(title: string): string {
  const trimmed = title.trim();
  return trimmed.replace(/[\\/:"*?<>|]/g, "-").replace(/\s+/g, " ");
}

export async function moveDocument(input: MoveDocumentInput): Promise<MoveDocumentResult> {
  const { slug, toFolder } = input;
  const folders = getProjectRoots();
  if (!folders.includes(toFolder)) throw new Error("VALIDATION_ERROR: toFolder not allowed");

  const vaultRoot = getVaultRoot();
  const srcAbs = findFileBySlug(slug, vaultRoot);
  if (!srcAbs) throw new Error(`NOT_FOUND: No document found for slug ${slug}`);
  const srcRel = path.relative(vaultRoot, srcAbs);
  const srcFolder = srcRel.split(path.sep)[0] || "Projects";

  // Compute new filename/path
  let nextTitle = input.newTitle ? String(input.newTitle) : path.basename(srcAbs, ".md");
  const keepSlug = input.newTitle ? Boolean(input.keepSlug) : true;
  const destDir = path.join(vaultRoot, toFolder);
  fs.mkdirSync(destDir, { recursive: true });
  const destFilename = `${sanitizeTitleForFilename(nextTitle)}.md`;
  const destAbs = path.join(destDir, destFilename);
  const destRel = path.relative(vaultRoot, destAbs);

  // Load content if title/slug update needed
  let content: string | null = null;
  if (!keepSlug || input.newTitle) {
    content = readFileSafely(srcRel).content;
    const lines = content.split(/\n|\r\n|\r/);
    if ((lines[0] ?? "").trim() === "---") {
      let idx = 1;
      const set = (k: string, v: string) => {
        // find key and replace or insert before closing
        let i = 1;
        let replaced = false;
        while (i < lines.length && ((lines[i] ?? "").trim() !== "---")) {
          const m = new RegExp(`^${k}:\\s*`).exec(String(lines[i] ?? ""));
          if (m) { lines[i] = `${k}: ${JSON.stringify(v)}`; replaced = true; }
          i += 1;
        }
        if (!replaced) {
          lines.splice(idx, 0, `${k}: ${JSON.stringify(v)}`);
        }
      };
      set("title", nextTitle);
      if (!keepSlug) {
        const newSlug = deriveSlugFromTitle(nextTitle);
        set("slug", newSlug);
      }
      // rebuild content
      content = lines.join("\n");
    }
  }

  const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
  const git = fs.existsSync(path.join(repoRoot, ".git")) ? simpleGit({ baseDir: repoRoot }) : null;

  // If content changed due to title/slug updates, write it before move
  if (content != null) {
    writeFileSafely(srcRel, content);
  }

  // Perform move (git mv if available)
  if (git) {
    await git.raw(["mv", srcRel, destRel]);
    await git.add([destRel]);
    await git.commit(`moveDocument(${slug}): ${srcFolder} -> ${toFolder}`);
  } else {
    fs.mkdirSync(path.dirname(destAbs), { recursive: true });
    fs.renameSync(srcAbs, destAbs);
  }

  // Best-effort push
  if (git) { try { await maybeAutoPush(repoRoot); } catch {} }

  // Diff best-effort
  let diff = "";
  let commit: string | null = null;
  let current_commit: string | null = null;
  if (git) {
    try { commit = (await git.revparse(["HEAD"]))?.trim() || null; } catch {}
    try { current_commit = commit; } catch {}
    try { if (commit) diff = await git.diff(["-U0", `${commit}^!`]); } catch {}
  }

  return { oldPath: srcRel, newPath: destRel, commit, diff, current_commit };
}


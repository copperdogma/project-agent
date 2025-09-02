import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot } from "./vault.js";

export interface UndoInput {
  commit: string;
}

export interface UndoResult {
  revert_commit: string | null;
  diff: string;
}

async function ensureGitRepo(vaultRoot: string): Promise<void> {
  const gitDir = path.join(vaultRoot, ".git");
  if (!fs.existsSync(gitDir)) throw new Error("NOT_A_REPO: vault is not a git repository");
}

async function verifyCommitExists(git: ReturnType<typeof simpleGit>, commit: string): Promise<void> {
  try {
    const t = await git.raw(["cat-file", "-t", commit]);
    if (!String(t || "").trim().startsWith("commit")) {
      throw new Error("NOT_FOUND_COMMIT");
    }
  } catch {
    throw new Error("NOT_FOUND_COMMIT: commit does not exist in repository");
  }
}

async function ensureCleanWorktree(git: ReturnType<typeof simpleGit>): Promise<void> {
  const st = await git.status();
  if (!st.isClean()) {
    throw new Error("WORKDIR_DIRTY: uncommitted changes present");
  }
}

async function isMergeCommit(git: ReturnType<typeof simpleGit>, commit: string): Promise<boolean> {
  try {
    const parents = await git.show(["--no-patch", "--pretty=%P", commit]);
    const parts = String(parents || "").trim().split(/\s+/).filter(Boolean);
    return parts.length > 1;
  } catch {
    return false;
  }
}

export async function undoCommit(input: UndoInput): Promise<UndoResult> {
  const { commit } = input;
  const vaultRoot = getVaultRoot();
  await ensureGitRepo(vaultRoot);
  const git = simpleGit({ baseDir: vaultRoot });

  // Validate commit exists in this repo
  await verifyCommitExists(git, commit);
  await ensureCleanWorktree(git);

  // Not supporting reverting merge commits yet to avoid complex parent selection/conflicts
  if (await isMergeCommit(git, commit)) {
    throw new Error("MERGE_COMMIT_NOT_SUPPORTED: select a non-merge commit to revert");
  }

  // Perform revert with no edit; generate new commit
  try {
    await git.raw(["revert", "--no-edit", commit]);
  } catch (err) {
    // Attempt to abort on conflicts to leave repo clean-ish
    try {
      await git.raw(["revert", "--abort"]);
    } catch {}
    throw new Error("REVERT_FAILED: unable to revert commit");
  }

  // HEAD is now the revert commit
  let revertCommit = "";
  try {
    revertCommit = (await git.revparse(["HEAD"]))?.trim() || "";
  } catch {}

  let diff = "";
  if (revertCommit) {
    try {
      diff = await git.diff(["-U0", `${revertCommit}^!`]);
    } catch {
      try {
        diff = await git.show(["-U0", revertCommit]);
      } catch {}
    }
  }

  return { revert_commit: revertCommit || null, diff };
}



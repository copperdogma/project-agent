import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";
import { getVaultRoot, findGitRoot } from "./vault.js";

export interface UndoInput {
  commit: string;
}

export interface UndoResult {
  revert_commit: string | null;
  diff: string;
}

async function ensureGitRepo(vaultRoot: string): Promise<void> {
  const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
  const gitDir = path.join(repoRoot, ".git");
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
  if (st.isClean()) return;
  // Allow untracked/modified files only under .project-agent/**
  const allow = (file: string) => file.startsWith(".project-agent/") || file === ".project-agent";
  const untrackedOk = (st.files || []).every((f) => {
    const p = f.path || "";
    // If outside .project-agent, not okay
    if (!allow(p)) return false;
    return true;
  });
  const notStagedOk = (st.not_added || []).every((p) => allow(String(p)));
  const createdOk = (st.created || []).every((p) => allow(String(p)));
  const modifiedOk = (st.modified || []).every((p) => allow(String(p)));
  const renamedOk = (st.renamed || []).every((r) => allow(String((r as any)?.to || "")) && allow(String((r as any)?.from || "")));
  const deletedOk = (st.deleted || []).every((p) => allow(String(p)));

  if (untrackedOk && notStagedOk && createdOk && modifiedOk && renamedOk && deletedOk) return;
  throw new Error("WORKDIR_DIRTY: uncommitted changes present");
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
  const repoRoot = findGitRoot(vaultRoot) || vaultRoot;
  const git = simpleGit({ baseDir: repoRoot });

  // Validate commit exists in this repo
  await verifyCommitExists(git, commit);
  await ensureCleanWorktree(git);

  // Not supporting reverting merge commits yet to avoid complex parent selection/conflicts
  if (await isMergeCommit(git, commit)) {
    throw new Error("MERGE_COMMIT_NOT_SUPPORTED: select a non-merge commit to revert");
  }

  // Perform revert with no edit; generate new commit
  try {
    const authorName = String(process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || "Project Agent").trim() || "Project Agent";
    const authorEmail = String(process.env.GIT_AUTHOR_EMAIL || process.env.GIT_COMMITTER_EMAIL || "robot@local").trim() || "robot@local";
    const committerName = String(process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || authorName).trim() || authorName;
    const committerEmail = String(process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || authorEmail).trim() || authorEmail;

    // Configure committer and set author for the generated revert commit
    await git.raw(["-c", `user.name=${committerName}`, "-c", `user.email=${committerEmail}`, "revert", "--no-edit", "--no-commit", commit]);
    await git.raw(["-c", `user.name=${committerName}`, "-c", `user.email=${committerEmail}`, "commit", "--no-verify", "--author", `${authorName} <${authorEmail}>`, "-m", `Revert ${commit}`]);
  } catch {
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



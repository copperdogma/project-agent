import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";

type PushResult = { ok: boolean; remote: string; branch: string; step?: string; message?: string };

async function currentBranch(repoRoot: string): Promise<string> {
  try {
    const git = simpleGit({ baseDir: repoRoot });
    const cur = await git.revparse(["--abbrev-ref", "HEAD"]);
    const name = (cur || "main").trim() || "main";
    return name;
  } catch {
    return "main";
  }
}

async function ensureCommitAll(repoRoot: string): Promise<void> {
  try {
    const git = simpleGit({ baseDir: repoRoot });
    const status = await git.status();
    if (!status.isClean()) {
      await git.add(["-A"]);
      const authorName = String(process.env.GIT_AUTHOR_NAME || process.env.GIT_COMMITTER_NAME || "Project Agent").trim() || "Project Agent";
      const authorEmail = String(process.env.GIT_AUTHOR_EMAIL || process.env.GIT_COMMITTER_EMAIL || "robot@local").trim() || "robot@local";
      const committerName = String(process.env.GIT_COMMITTER_NAME || process.env.GIT_AUTHOR_NAME || authorName).trim() || authorName;
      const committerEmail = String(process.env.GIT_COMMITTER_EMAIL || process.env.GIT_AUTHOR_EMAIL || authorEmail).trim() || authorEmail;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await git.raw([
        "-c", `user.name=${committerName}`,
        "-c", `user.email=${committerEmail}`,
        "commit",
        "-m", `auto: stage and commit local changes (${stamp})`,
        "--author", `${authorName} <${authorEmail}>`,
      ]);
    }
  } catch {
    // best effort
  }
}

async function robustPush(repoRoot: string, remoteName: string, branchName: string): Promise<PushResult> {
  const git = simpleGit({ baseDir: repoRoot });
  const remote = remoteName;
  const branch = branchName;
  // 1) Normal push
  try {
    await git.push([remote, `HEAD:${branch}`]);
    return { ok: true, remote, branch, step: "push" };
  } catch (err: any) {
    // continue
  }
  // 2) Fetch + rebase
  try {
    await git.fetch([remote, branch]);
    await git.raw(["rebase", `${remote}/${branch}`]);
    await git.push([remote, `HEAD:${branch}`]);
    return { ok: true, remote, branch, step: "rebase_then_push" };
  } catch (err: any) {
    try { await git.raw(["rebase", "--abort"]); } catch {}
  }
  // 3) Force-with-lease
  try {
    await git.push(["--force-with-lease", remote, `HEAD:${branch}`]);
    return { ok: true, remote, branch, step: "force-with-lease" };
  } catch (err: any) {
    // continue
  }
  // 4) Last resort: --force
  try {
    await git.push(["--force", remote, `HEAD:${branch}`]);
    return { ok: true, remote, branch, step: "force" };
  } catch (err: any) {
    return { ok: false, remote, branch, step: "failed", message: String(err?.message || err) };
  }
}

export async function maybeAutoPush(repoRoot: string): Promise<void> {
  try {
    const auto = String(process.env.GIT_AUTO_PUSH ?? "true").toLowerCase() === "true";
    if (!auto) return;
    if (!fs.existsSync(path.join(repoRoot, ".git"))) return;
    const git = simpleGit({ baseDir: repoRoot });

    // Ensure we have at least one remote
    const remotes = await git.getRemotes(true);
    if (!remotes || remotes.length === 0) return;
    const remoteName = String(process.env.GIT_REMOTE_NAME || "origin");
    const hasRemote = remotes.some((r) => r.name === remoteName);
    if (!hasRemote) return;

    // Determine current branch
    const branch = await currentBranch(repoRoot);

    // Best-effort robust push with fallbacks
    try {
      // eslint-disable-next-line no-console
      console.info("auto-push: attempting", { repoRoot, remoteName, branch });
      const res = await robustPush(repoRoot, remoteName, branch);
      if (res.ok) {
        // eslint-disable-next-line no-console
        console.info("auto-push: success", { repoRoot, remoteName, branch, step: res.step });
      } else {
        // eslint-disable-next-line no-console
        console.warn("auto-push: failed", { repoRoot, remoteName, branch, message: res.message });
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn("auto-push: failed", { repoRoot, remoteName, branch, message: String(err?.message || err) });
    }
  } catch {
    // ignore
  }
}

export async function pushCurrentRepo(repoRoot: string, remoteName?: string, branchName?: string): Promise<{ ok: boolean; remote: string; branch: string; step?: string; message?: string }>
{
  try {
    if (!fs.existsSync(path.join(repoRoot, ".git"))) return { ok: false, remote: remoteName || "origin", branch: branchName || "main", message: "NOT_A_REPO" };
    const git = simpleGit({ baseDir: repoRoot });
    const remotes = await git.getRemotes(true);
    const remote = remoteName || "origin";
    const branch = (branchName || (await git.revparse(["--abbrev-ref","HEAD"])) || "main").trim() || "main";
    if (!remotes.some((r) => r.name === remote)) {
      return { ok: false, remote, branch, message: "REMOTE_NOT_FOUND" };
    }
    // Proactively stage and commit any local changes before pushing
    await ensureCommitAll(repoRoot);
    const res = await robustPush(repoRoot, remote, branch);
    return res;
  } catch (err: any) {
    return { ok: false, remote: remoteName || "origin", branch: branchName || "main", message: String(err?.message || err) };
  }
}

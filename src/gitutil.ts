import fs from "fs";
import path from "path";
import { simpleGit } from "simple-git";

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
    let branch = "main";
    try {
      const cur = await git.revparse(["--abbrev-ref", "HEAD"]);
      branch = (cur || "main").trim() || "main";
    } catch {}

    // Push HEAD to remote branch explicitly; avoid failing the request if push fails
    try {
      // eslint-disable-next-line no-console
      console.info("auto-push: attempting", { repoRoot, remoteName, branch });
      await git.push([remoteName, `HEAD:${branch}`]);
      // eslint-disable-next-line no-console
      console.info("auto-push: success", { repoRoot, remoteName, branch });
    } catch (err) {
      // Best effort: ignore push failures (e.g., auth)
      // eslint-disable-next-line no-console
      console.warn("auto-push: failed", { repoRoot, remoteName, branch, message: (err as any)?.message });
    }
  } catch {
    // ignore
  }
}

export async function pushCurrentRepo(repoRoot: string, remoteName?: string, branchName?: string): Promise<{ ok: boolean; remote: string; branch: string; message?: string }>
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
    try {
      await git.push([remote, `HEAD:${branch}`]);
      return { ok: true, remote, branch };
    } catch (err: any) {
      return { ok: false, remote, branch, message: String(err?.message || err) };
    }
  } catch (err: any) {
    return { ok: false, remote: remoteName || "origin", branch: branchName || "main", message: String(err?.message || err) };
  }
}

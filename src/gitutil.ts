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
      await git.push([remoteName, `HEAD:${branch}`]);
    } catch (err) {
      // Best effort: ignore push failures (e.g., auth)
      // eslint-disable-next-line no-console
      console.warn("maybeAutoPush: push failed", { message: (err as any)?.message });
    }
  } catch {
    // ignore
  }
}


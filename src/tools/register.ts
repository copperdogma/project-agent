import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSnapshot } from "../snapshot.js";
import { getDocument } from "../document.js";
import { listProjects } from "../list.js";
import { applyOps } from "../apply.js";
import { createProject } from "../create.js";
import { undoCommit } from "../undo.js";

export function registerProjectTools(mcpServer: McpServer): void {
  mcpServer.registerTool(
    "project_snapshot",
    {
      description: "Return a compact snapshot for a project by slug.\n" +
        "Fields: {frontmatter,toc,per_section_tail,anchors_index,recent_ops,current_commit,date_local,tz,path,size_bytes}.\n" +
        "Example: {\"toc\":[\"Notes\"],\"per_section_tail\":{\"Notes\":[\"20250101 ai:... ^abc123\"]},\"anchors_index\":{\"^abc123\":{section:\"Notes\",excerpt:\"...\"}},...}",
      inputSchema: { slug: z.string() },
    },
    async (args: any) => {
      const slug = String(args?.slug || "");
      const payload = await buildSnapshot(slug);
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  mcpServer.registerTool(
    "project_get_document",
    {
      description: "Return full document content and metadata by slug.\n" +
        "Fields: {frontmatter,content,path,size_bytes,current_commit,date_local,tz}. content is UTF-8 markdown.",
      inputSchema: { slug: z.string() },
    },
    async (args: any) => {
      const slug = String(args?.slug || "");
      const payload = await getDocument(slug);
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  mcpServer.registerTool(
    "project_list",
    { description: "List available projects (title, slug, path). Sorted by title; slugs are unique.", inputSchema: {} },
    async () => {
      const payload = listProjects();
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  mcpServer.registerTool(
    "project_apply_ops",
    {
      description:
        "Apply deterministic ops to a document (append/move/update/delete).\n" +
        "Anchors: inline markers like ^abc123 (6–8 base36, optional -b on collision). Not line numbers.\n" +
        "Missing anchors: operations referencing a non-existent anchor fail with MISSING_ANCHOR.\n" +
        "Sections: Markdown headings (# .. ######). Ops target section bodies; section order is preserved.\n" +
        "Append: appends to tail of an EXISTING section only (MISSING_SECTION if unknown). Section creation is not yet supported.\n" +
        "Update/Delete/Move: locate lines by anchor, preserve or move the anchored line accordingly.\n" +
        "Dedup: append skips if exact text or normalized URL already exists in target section.",
      inputSchema: {
        slug: z.string(),
        ops: z.array(
          z.union([
            z.object({ type: z.literal("append"), section: z.string(), text: z.string() }),
            z.object({ type: z.literal("move_by_anchor"), anchor: z.string(), to_section: z.string() }),
            z.object({ type: z.literal("update_by_anchor"), anchor: z.string(), new_text: z.string() }),
            z.object({ type: z.literal("delete_by_anchor"), anchor: z.string() }),
          ]),
        ),
        expected_commit: z.string().nullable().optional(),
        idempotency_key: z.string().nullable().optional(),
      },
    },
    async (args: any) => {
      const payload = await applyOps({
        slug: String(args?.slug || ""),
        ops: Array.isArray(args?.ops) ? (args.ops as any[]) : [],
        expected_commit: args?.expected_commit ?? null,
        idempotency_key: args?.idempotency_key ?? null,
      });
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  mcpServer.registerTool(
    "project_create",
    {
      description:
        "Create a new project document under Projects/<Title>.md and add it to registry.\n" +
        "Slug: optional; auto-generated from title if omitted (lowercase, dashes).\n" +
        "router_email: optional metadata for routing/ownership; stored in frontmatter if provided.\n" +
        "Validation: title is required; filename is sanitized (replaces unsafe chars). Unique slug enforced via registry.\n" +
        "Template: creates frontmatter (title, slug, router_email?) and starter sections: Uncategorized, Notes, Resources.\n" +
        "Returns: {title, slug, path}.",
      inputSchema: {
        title: z.string(),
        slug: z.string().optional(),
        router_email: z.string().optional(),
      },
    },
    async (args: any) => {
      const input: any = { title: String(args?.title || "") };
      if (args?.slug !== undefined) input.slug = String(args.slug);
      if (args?.router_email !== undefined) input.router_email = String(args.router_email);
      const payload = createProject(input);
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  mcpServer.registerTool(
    "project_undo",
    {
      description:
        "Undo (revert) a commit in the vault git repository.\n" +
        "Commit discovery: use commit hashes from applyOps responses (commit), or the current_commit in snapshot/getDocument; you can also view git log externally (a history tool may arrive later).\n" +
        "Scope: reverts ONLY the specified commit (later commits remain); this creates a new revert commit (no history rewrite). You can revert the revert if needed.\n" +
        "Preconditions: worktree must be clean; merge commits are not supported (MERGE_COMMIT_NOT_SUPPORTED).\n" +
        "Usage: (1) Ensure no uncommitted changes; (2) Pick a non-merge commit hash (e.g., from applyOps.commit); (3) Call project_undo with {commit}.\n" +
        "Errors: NOT_A_REPO when vault is not a git repo; NOT_FOUND_COMMIT when the commit is unknown; WORKDIR_DIRTY when uncommitted changes exist; REVERT_FAILED on conflicts.\n" +
        "Return: JSON {revert_commit:string|null, diff:string} where diff is git unified diff for that revert commit (commit^!).\n" +
        "Example input: {\"commit\":\"abc123...\"}. Example output: {\"revert_commit\":\"def456...\",\"diff\":\"diff --git ...\"}",
      inputSchema: { commit: z.string() },
    },
    async (args: any) => {
      const payload = await undoCommit({ commit: String(args?.commit || "") });
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

}

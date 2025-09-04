import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSnapshot } from "../snapshot.js";
import { getDocument } from "../document.js";
import { listProjects } from "../list.js";
import { applyOps } from "../apply.js";
import { createProject } from "../create.js";
import { undoCommit } from "../undo.js";
import { errorFromException, makeError } from "../errors.js";
import { writeAudit } from "../audit.js";
import { allow as rateAllow } from "../rate.js";

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
      try {
        const slug = String(args?.slug || "");
        const payload = await buildSnapshot(slug);
        const maxBytes = Number(process.env.SNAPSHOT_MAX_BYTES || 256 * 1024);
        if (Number.isFinite(maxBytes) && maxBytes > 0 && payload.size_bytes > maxBytes) {
          return { content: [{ type: "text", text: JSON.stringify(makeError("PAYLOAD_TOO_LARGE", `Snapshot exceeds limit (${maxBytes} bytes)`, { size_bytes: payload.size_bytes, max_bytes: maxBytes })) }] };
        }
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  // project_head_commit intentionally not registered in public catalog (kept internally for tests)

  mcpServer.registerTool(
    "project_get_document",
    {
      description: "Return full document content and metadata by slug.\n" +
        "Fields: {frontmatter,content,path,size_bytes,current_commit,date_local,tz}. content is UTF-8 markdown.\n" +
        "Optional: suppressContent (boolean) to omit content, maxBytes (number) to truncate content.",
      inputSchema: { slug: z.string(), suppressContent: z.boolean().optional(), maxBytes: z.number().optional() },
    },
    async (args: any) => {
      try {
        const slug = String(args?.slug || "");
        const payload = await getDocument(slug);
        if (args?.suppressContent === true) {
          (payload as any).content = "";
        } else if (typeof args?.maxBytes === "number" && args.maxBytes > 0) {
          const content: string = String((payload as any).content || "");
          if (Buffer.byteLength(content, "utf8") > args.maxBytes) {
            (payload as any).content = content.slice(0, args.maxBytes);
          }
        }
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  // server_config intentionally not registered in public catalog (kept internally for diagnostics)

  mcpServer.registerTool(
    "project_list",
    { description: "List available projects (title, slug, path). Sorted by title; slugs are unique.", inputSchema: {} },
    async () => {
      try {
        const payload = listProjects();
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );


  // v2 simple write tools: append/update/move/delete
  mcpServer.registerTool(
    "project_append",
    {
      description: "Append a line to an existing section. Optional optimistic concurrency and idempotency.",
      inputSchema: { slug: z.string(), section: z.string(), text: z.string(), expectedCommit: z.string().nullable().optional(), idempotencyKey: z.string().nullable().optional() },
    },
    async (args: any) => {
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:${String(args?.slug || "")}`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        const expectedCommit = (typeof args?.expectedCommit === "string" && args.expectedCommit.trim().length > 0) ? String(args.expectedCommit) : null;
        const idempotencyKey = (typeof args?.idempotencyKey === "string" && args.idempotencyKey.trim().length > 0) ? String(args.idempotencyKey) : null;
        const payload = await applyOps({
          slug: String(args?.slug || ""),
          ops: [{ type: "append", section: String(args?.section || ""), text: String(args?.text || "") }],
          expected_commit: expectedCommit,
          idempotency_key: idempotencyKey,
        });
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_append", slug: String(args?.slug || ""), summary: payload.summary, commit: payload.commit });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  mcpServer.registerTool(
    "project_update_by_anchor",
    {
      description: "Update a line by anchor.",
      inputSchema: { slug: z.string(), anchor: z.string(), newText: z.string(), expectedCommit: z.string().nullable().optional(), idempotencyKey: z.string().nullable().optional() },
    },
    async (args: any) => {
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:${String(args?.slug || "")}`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        const expectedCommit = (typeof args?.expectedCommit === "string" && args.expectedCommit.trim().length > 0) ? String(args.expectedCommit) : null;
        const idempotencyKey = (typeof args?.idempotencyKey === "string" && args.idempotencyKey.trim().length > 0) ? String(args.idempotencyKey) : null;
        const payload = await applyOps({
          slug: String(args?.slug || ""),
          ops: [{ type: "update_by_anchor", anchor: String(args?.anchor || ""), new_text: String(args?.newText || "") }],
          expected_commit: expectedCommit,
          idempotency_key: idempotencyKey,
        });
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_update_by_anchor", slug: String(args?.slug || ""), summary: payload.summary, commit: payload.commit });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  mcpServer.registerTool(
    "project_move_by_anchor",
    {
      description: "Move a line identified by anchor to another section.",
      inputSchema: { slug: z.string(), anchor: z.string(), toSection: z.string(), expectedCommit: z.string().nullable().optional(), idempotencyKey: z.string().nullable().optional() },
    },
    async (args: any) => {
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:${String(args?.slug || "")}`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        const expectedCommit = (typeof args?.expectedCommit === "string" && args.expectedCommit.trim().length > 0) ? String(args.expectedCommit) : null;
        const idempotencyKey = (typeof args?.idempotencyKey === "string" && args.idempotencyKey.trim().length > 0) ? String(args.idempotencyKey) : null;
        const payload = await applyOps({
          slug: String(args?.slug || ""),
          ops: [{ type: "move_by_anchor", anchor: String(args?.anchor || ""), to_section: String(args?.toSection || "") }],
          expected_commit: expectedCommit,
          idempotency_key: idempotencyKey,
        });
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_move_by_anchor", slug: String(args?.slug || ""), summary: payload.summary, commit: payload.commit });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  mcpServer.registerTool(
    "project_delete_by_anchor",
    {
      description: "Delete a line by anchor.",
      inputSchema: { slug: z.string(), anchor: z.string(), expectedCommit: z.string().nullable().optional(), idempotencyKey: z.string().nullable().optional() },
    },
    async (args: any) => {
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:${String(args?.slug || "")}`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        const expectedCommit = (typeof args?.expectedCommit === "string" && args.expectedCommit.trim().length > 0) ? String(args.expectedCommit) : null;
        const idempotencyKey = (typeof args?.idempotencyKey === "string" && args.idempotencyKey.trim().length > 0) ? String(args.idempotencyKey) : null;
        const payload = await applyOps({
          slug: String(args?.slug || ""),
          ops: [{ type: "delete_by_anchor", anchor: String(args?.anchor || "") }],
          expected_commit: expectedCommit,
          idempotency_key: idempotencyKey,
        });
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_delete_by_anchor", slug: String(args?.slug || ""), summary: payload.summary, commit: payload.commit });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
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
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) {
          return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        }
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:create`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) {
          return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        }
        const input: any = { title: String(args?.title || "") };
        if (args?.slug !== undefined) input.slug = String(args.slug);
        if (args?.router_email !== undefined) input.router_email = String(args.router_email);
        const payload = await createProject(input);
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_create", slug: payload?.slug || input?.slug, summary: ["create"], commit: null });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

  mcpServer.registerTool(
    "project_undo",
    {
      description:
        "Undo (revert) a commit in the vault git repository.\n" +
        "Commit discovery: use commit hashes returned by write tools (e.g., project_append), or the current_commit in snapshot/getDocument; you can also view git log externally (a history tool may arrive later).\n" +
        "Scope: reverts ONLY the specified commit (later commits remain); this creates a new revert commit (no history rewrite). You can revert the revert if needed.\n" +
        "Preconditions: worktree must be clean; merge commits are not supported (MERGE_COMMIT_NOT_SUPPORTED).\n" +
        "Usage: (1) Ensure no uncommitted changes; (2) Pick a non-merge commit hash (e.g., from write tool responses); (3) Call project_undo with {commit}.\n" +
        "Errors: NOT_A_REPO when vault is not a git repo; NOT_FOUND_COMMIT when the commit is unknown; WORKDIR_DIRTY when uncommitted changes exist; REVERT_FAILED on conflicts.\n" +
        "Return: JSON {revert_commit:string|null, diff:string} where diff is git unified diff for that revert commit (commit^!).\n" +
        "Example input: {\"commit\":\"abc123...\"}. Example output: {\"revert_commit\":\"def456...\",\"diff\":\"diff --git ...\"}",
      inputSchema: { commit: z.string() },
    },
    async (args: any) => {
      try {
        const readonly = String(process.env.READONLY || "false").toLowerCase() === "true";
        if (readonly) {
          return { content: [{ type: "text", text: JSON.stringify(makeError("READ_ONLY", "Server in read-only mode", {})) }] };
        }
        const email = String(process.env.EMAIL_OVERRIDE || "anonymous");
        const key = `${email}:undo`;
        const cap = Number(process.env.RATE_LIMIT_WRITE_MAX || 20);
        const windowSec = Number(process.env.RATE_LIMIT_WRITE_WINDOW_S || 60);
        if (!rateAllow(key, cap, windowSec)) {
          return { content: [{ type: "text", text: JSON.stringify(makeError("RATE_LIMITED", "Write rate limit exceeded", { key })) }] };
        }
        const payload = await undoCommit({ commit: String(args?.commit || "") });
        writeAudit({ ts: new Date().toISOString(), email, tool: "project_undo", summary: ["undo"], commit: payload?.revert_commit ?? null });
        return { content: [{ type: "text", text: JSON.stringify(payload) }] };
      } catch (err) {
        return { content: [{ type: "text", text: JSON.stringify(errorFromException(err)) }] };
      }
    },
  );

}

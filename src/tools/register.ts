import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildSnapshot } from "../snapshot.js";
import { getDocument } from "../document.js";
import { listProjects } from "../list.js";
import { applyOps } from "../apply.js";

export function registerProjectTools(mcpServer: McpServer): void {
  mcpServer.registerTool(
    "project_snapshot",
    {
      description: "Return a compact snapshot for a project by slug",
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
      description: "Return full document content and metadata by slug",
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
    { description: "List available projects (title, slug, path)", inputSchema: {} },
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
}

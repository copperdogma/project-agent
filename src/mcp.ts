import "dotenv/config";
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildSnapshot } from "./snapshot.js";
import { getDocument } from "./document.js";
import { listProjects } from "./list.js";
import { registerProjectTools } from "./tools/register.js";

const appName = "project-agent";
const appVersion = "1.0.0";

async function main(): Promise<void> {
  const mcpServer = new McpServer({ name: appName, version: appVersion });

  // server_health
  mcpServer.registerTool(
    "server_health",
    {
      description: "Operational readiness and uptime",
      inputSchema: {},
    },
    async () => {
      const payload = { status: "ok", uptime_s: Math.round(process.uptime()) };
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    },
  );

  // server_version
  mcpServer.registerTool(
    "server_version",
    {
      description: "Versioning and compatibility",
      inputSchema: {},
    },
    async () => {
      let result = { app: appName, version: appVersion, schema: "2025-09-01" };
      try {
        const pkg = JSON.parse(
          fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
        );
        result = {
          app: pkg.name ?? appName,
          version: pkg.version ?? appVersion,
          schema: "2025-09-01",
        };
      } catch {
        // use default
      }
      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    },
  );

  // project tools
  registerProjectTools(mcpServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("MCP server failed", err);
  process.exit(1);
});

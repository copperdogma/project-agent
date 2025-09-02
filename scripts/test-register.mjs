import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerProjectTools } from "../dist/tools/register.js";

async function run() {
  const mcp = new McpServer({ name: "test", version: "0.0.0" });
  registerProjectTools(mcp);
  // Try multiple known shapes to read registered tools
  const required = [
    "project_list",
    "project_snapshot",
    "project_get_document",
    "project_apply_ops",
  ];

  function extractToolNames(obj) {
    const candidates = [];
    const props = new Set([
      "tools",
      "_tools",
      "registeredTools",
    ]);
    for (const key of Object.getOwnPropertyNames(obj)) props.add(key);
    for (const p of props) {
      const v = obj[p];
      if (!v) continue;
      if (v instanceof Map) {
        candidates.push(Array.from(v.keys()));
      } else if (typeof v === "object") {
        candidates.push(Object.keys(v));
      }
    }
    // Flatten unique
    const set = new Set();
    for (const arr of candidates) {
      for (const n of arr) set.add(n);
    }
    return Array.from(set);
  }

  const names = extractToolNames(mcp);
  for (const r of required) {
    if (!names.includes(r)) {
      throw new Error(`missing tool ${r}`);
    }
  }
  // eslint-disable-next-line no-console
  console.log("OK: registerProjectTools includes required tools");
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("register tools test failed", err);
  process.exit(1);
});

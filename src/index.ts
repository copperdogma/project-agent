import "dotenv/config";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import rateLimit from "@fastify/rate-limit";
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { buildSnapshot } from "./snapshot.js";
import { getDocument } from "./document.js";
import { listProjects } from "./list.js";
import { registerProjectTools } from "./tools/register.js";

// Optional HTTPS/mTLS if cert and key are provided
const tlsCertPath = process.env.TLS_CERT_PATH;
const tlsKeyPath = process.env.TLS_KEY_PATH;
const tlsCaPath = process.env.TLS_CA_PATH; // optional client CA for mTLS
const requireClientCert =
  String(process.env.MTLS_REQUIRED || "false").toLowerCase() === "true";
let httpsOptions:
  | {
      key: Buffer;
      cert: Buffer;
      requestCert?: boolean;
      ca?: Buffer | Buffer[];
      rejectUnauthorized?: boolean;
    }
  | undefined;
if (
  tlsCertPath &&
  tlsKeyPath &&
  fs.existsSync(tlsCertPath) &&
  fs.existsSync(tlsKeyPath)
) {
  httpsOptions = {
    key: fs.readFileSync(tlsKeyPath),
    cert: fs.readFileSync(tlsCertPath),
  } as any;
  if (tlsCaPath && fs.existsSync(tlsCaPath)) {
    (httpsOptions as any).ca = fs.readFileSync(tlsCaPath);
    (httpsOptions as any).requestCert = true;
    (httpsOptions as any).rejectUnauthorized = requireClientCert;
  }
}

let app: FastifyInstance;
if (httpsOptions) {
  app = Fastify({
    logger: { level: process.env.LOG_LEVEL || "info" },
    https: httpsOptions as any,
  });
} else {
  app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
}

// Read-only guard: block non-GET methods when READONLY=true
const READONLY =
  String(process.env.READONLY || "false").toLowerCase() === "true";
app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
  if (READONLY && req.method !== "GET") {
    return reply
      .code(403)
      .send({
        error: {
          code: "READ_ONLY",
          message: "Server in read-only mode",
          details: {},
        },
      });
  }
});

// Basic rate limiting (skeleton); per-IP by default
await app.register(rateLimit as any, {
  max: Number(process.env.RATE_LIMIT_MAX || 100),
  timeWindow: process.env.RATE_LIMIT_WINDOW || "1 minute",
});

// Minimal MCP over SSE for remote URL clients (e.g., Claude)
type TransportEntry = { transport: SSEServerTransport; server: McpServer };
const sseSessions = new Map<string, TransportEntry>();
let lastSessionId: string | null = null;

function extractSessionId(req: FastifyRequest): string | null {
  try {
    const raw = (req.raw as any)?.url as string | undefined;
    if (raw && raw.includes("?")) {
      const qs = raw.slice(raw.indexOf("?") + 1);
      const params = new URLSearchParams(qs);
      const v = params.get("sessionId");
      if (v) return v;
    }
  } catch {}
  const q = (req as any).query as { sessionId?: string } | undefined;
  return q?.sessionId ?? null;
}

function registerMcpTools(mcpServer: McpServer): void {
  mcpServer.registerTool(
    "server_health",
    { description: "Operational readiness and uptime", inputSchema: {} },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "ok",
            uptime_s: Math.round(process.uptime()),
          }),
        },
      ],
    }),
  );
  mcpServer.registerTool(
    "server_version",
    { description: "Versioning and compatibility", inputSchema: {} },
    async () => {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                app: pkg.name ?? "project-agent",
                version: pkg.version ?? "0.0.0",
                schema: "2025-09-01",
              }),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                app: "project-agent",
                version: "0.0.0",
                schema: "2025-09-01",
              }),
            },
          ],
        };
      }
    },
  );

  // project tools
  registerProjectTools(mcpServer);
}

// Authentication/authorization preHandler
const DEV_BEARER_TOKEN = process.env.DEV_BEARER_TOKEN;
const EMAIL_ALLOWLIST = (
  process.env.EMAIL_ALLOWLIST || "cam.marsollier@gmail.com"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const EMAIL_OVERRIDE = process.env.EMAIL_OVERRIDE;

app.addHook("preHandler", async (req: FastifyRequest, reply: FastifyReply) => {
  // Skip auth for health/version endpoints
  if (req.url === "/health" || req.url === "/version") return;
  const pathOnly = req.url.split("?")[0] || "";
  const isSsePath = pathOnly.startsWith("/mcp/sse") || pathOnly.startsWith("/sse");
  // Allow HEAD/GET on SSE endpoints without auth so clients can establish the stream
  if ((req.method === "HEAD" || req.method === "GET") && isSsePath) return;
  // Allow POST to /mcp/sse/:sessionId when session exists (already authenticated at session creation)
  if (req.method === "POST" && (pathOnly.startsWith("/mcp/sse/") || pathOnly.startsWith("/sse/"))) {
    const parts = pathOnly.split("/");
    const sessionId = parts[parts.length - 1];
    if (sessionId && sseSessions.has(sessionId)) return;
  }
  // Also allow POST to /mcp/sse?sessionId=... (query param form)
  if (req.method === "POST" && (pathOnly === "/mcp/sse" || pathOnly === "/sse")) {
    const sessionId = extractSessionId(req) || "";
    if (sessionId && sseSessions.has(sessionId)) return;
    // Fallback: if exactly one session exists, allow it (dev convenience)
    if (!sessionId && (sseSessions.size === 1 || lastSessionId)) return;
  }

  // When HTTPS with requestCert enabled, use client certificate subject as signal (if provided)
  const hasClientCert = (req.socket as any)?.authorized === true;

  // Dev bearer token path (only when provided)
  let isAuthenticated = false;
  if (DEV_BEARER_TOKEN) {
    const auth = req.headers["authorization"];
    if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
      const token = auth.substring("Bearer ".length);
      if (token === DEV_BEARER_TOKEN) {
        isAuthenticated = true;
      }
    }
    // Fallback: allow token via query on MCP SSE endpoints for dev convenience
    if (!isAuthenticated && isSsePath) {
      const q = (req as any).query || {};
      if (q.token && q.token === DEV_BEARER_TOKEN) {
        isAuthenticated = true;
      }
    }
  }

  // mTLS path: if client cert is required, enforce authorization flag
  if (!isAuthenticated && requireClientCert) {
    if (!hasClientCert) {
      return reply
        .code(401)
        .send({
          error: {
            code: "UNAUTHORIZED",
            message: "Client certificate required",
            details: {},
          },
        });
    }
    isAuthenticated = true;
  }

  if (!isAuthenticated && (httpsOptions as any)?.requestCert) {
    // If cert requested but not strictly required, allow but continue to email check
    isAuthenticated = true;
  }

  if (!isAuthenticated) {
    return reply
      .code(401)
      .send({
        error: {
          code: "UNAUTHORIZED",
          message: "Missing/invalid credentials",
          details: {},
        },
      });
  }

  // Enforce email allowlist via header; allow override in dev
  const q = (req as any).query || {};
  const emailHeader =
    (req.headers["x-user-email"] as string | undefined) ||
    (isSsePath ? (q.email as string | undefined) : undefined) ||
    EMAIL_OVERRIDE ||
    "";
  // For SSE endpoints, allow bearer-token-only auth (no email header required)
  if (!isSsePath) {
    if (!emailHeader) {
      return reply
        .code(403)
        .send({
          error: {
            code: "FORBIDDEN_EMAIL",
            message: "Missing x-user-email",
            details: {},
          },
        });
    }
    const isAllowed = EMAIL_ALLOWLIST.includes(emailHeader);
    if (!isAllowed) {
      return reply
        .code(403)
        .send({
          error: {
            code: "FORBIDDEN_EMAIL",
            message: "Email not allowed",
            details: { email: emailHeader },
          },
        });
    }
  }
});

app.get("/health", async (_req: FastifyRequest, _reply: FastifyReply) => ({
  status: "ok",
  uptime_s: Math.round(process.uptime()),
}));

// Expose version info
app.get("/version", async (_req: FastifyRequest, _reply: FastifyReply) => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    return {
      app: pkg.name ?? "project-agent",
      version: pkg.version ?? "0.0.0",
      schema: "2025-09-01",
    };
  } catch {
    return { app: "project-agent", version: "0.0.0", schema: "2025-09-01" };
  }
});

// Start SSE session: GET establishes stream
app.get("/mcp/sse", async (_req: FastifyRequest, reply: FastifyReply) => {
  const mcp = new McpServer({ name: "project-agent", version: "1.0.0" });
  registerMcpTools(mcp);
  const transport = new SSEServerTransport("/mcp/sse", reply.raw);
  // Expose session id for debugging/clients and log registration
  try {
    reply.header("x-mcp-session-id", (transport as any).sessionId);
  } catch {}
  try {
    (app as any).log?.info(
      { sessionId: (transport as any).sessionId, beforeSize: sseSessions.size },
      "sse session registering",
    );
  } catch {}
  await mcp.connect(transport);
  sseSessions.set(transport.sessionId, { transport, server: mcp });
  try {
    (app as any).log?.info(
      {
        sessionId: transport.sessionId,
        afterSize: sseSessions.size,
        keys: Array.from(sseSessions.keys()),
      },
      "sse session registered",
    );
  } catch {}
  lastSessionId = transport.sessionId;
  // connect() already starts the SSE transport
});

// Alias endpoints for clients expecting "/sse" path
app.get("/sse", async (_req: FastifyRequest, reply: FastifyReply) => {
  const mcp = new McpServer({ name: "project-agent", version: "1.0.0" });
  registerMcpTools(mcp);
  const transport = new SSEServerTransport("/sse", reply.raw);
  try {
    reply.header("x-mcp-session-id", (transport as any).sessionId);
  } catch {}
  try {
    (app as any).log?.info(
      { sessionId: (transport as any).sessionId, beforeSize: sseSessions.size },
      "sse session registering (/sse)",
    );
  } catch {}
  await mcp.connect(transport);
  sseSessions.set(transport.sessionId, { transport, server: mcp });
  try {
    (app as any).log?.info(
      {
        sessionId: transport.sessionId,
        afterSize: sseSessions.size,
        keys: Array.from(sseSessions.keys()),
      },
      "sse session registered (/sse)",
    );
  } catch {}
  lastSessionId = transport.sessionId;
});

// Client POST messages are routed by sessionId
app.post(
  "/mcp/sse/:sessionId",
  async (
    req: FastifyRequest<{ Params: { sessionId: string }; Body: unknown }>,
    reply: FastifyReply,
  ) => {
    const entry = sseSessions.get(req.params.sessionId);
    if (!entry) {
      return reply
        .code(404)
        .send({
          error: {
            code: "NOT_FOUND",
            message: "Unknown SSE session",
            details: { sessionId: req.params.sessionId },
          },
        });
    }
    await entry.transport.handlePostMessage(
      req.raw as any,
      reply.raw,
      (req as any).body,
    );
  },
);

app.post(
  "/sse/:sessionId",
  async (
    req: FastifyRequest<{ Params: { sessionId: string }; Body: unknown }>,
    reply: FastifyReply,
  ) => {
    const entry = sseSessions.get(req.params.sessionId);
    if (!entry) {
      return reply
        .code(404)
        .send({
          error: {
            code: "NOT_FOUND",
            message: "Unknown SSE session",
            details: { sessionId: req.params.sessionId },
          },
        });
    }
    await entry.transport.handlePostMessage(
      req.raw as any,
      reply.raw,
      (req as any).body,
    );
  },
);

// Support POST with sessionId via query string
app.post(
  "/mcp/sse",
  async (
    req: FastifyRequest<{ Querystring: { sessionId?: string }; Body: unknown }>,
    reply: FastifyReply,
  ) => {
    const rawUrl = (req.raw as any)?.url as string | undefined;
    let sessionId: string = (extractSessionId(req) ?? "") as string;
    try {
      (app as any).log?.info(
        {
          rawUrl,
          parsedSessionId: sessionId,
          lastSessionId,
          size: sseSessions.size,
          keys: Array.from(sseSessions.keys()),
        },
        "POST /mcp/sse received",
      );
    } catch {}

    // If sessionId not provided, wait briefly for the SSE GET to establish
    if (!sessionId) {
      const startedAt = Date.now();
      while (!sessionId && Date.now() - startedAt < 5000) {
        if (sseSessions.size === 1) {
          sessionId = Array.from(sseSessions.keys())[0] as string;
          break;
        }
        if (lastSessionId) {
          sessionId = lastSessionId as string;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (!sessionId && sseSessions.size === 1) {
      sessionId = Array.from(sseSessions.keys())[0] as string;
    }
    if (!sessionId && lastSessionId) {
      sessionId = lastSessionId as string;
    }
    if (!sessionId) {
      try {
        (app as any).log?.warn(
          { size: sseSessions.size, lastSessionId },
          "POST /mcp/sse no session available",
        );
      } catch {}
      return reply
        .code(503)
        .send({
          error: {
            code: "SSE_NOT_READY",
            message: "SSE connection not established",
            details: {},
          },
        });
    }
    const entry = sseSessions.get(sessionId);
    if (!entry) {
      try {
        (app as any).log?.warn(
          { sessionId, keys: Array.from(sseSessions.keys()) },
          "POST /mcp/sse unknown session",
        );
      } catch {}
      return reply
        .code(404)
        .send({
          error: {
            code: "NOT_FOUND",
            message: "Unknown SSE session",
            details: { sessionId },
          },
        });
    }
    await entry.transport.handlePostMessage(
      req.raw as any,
      reply.raw,
      (req as any).body,
    );
    try {
      (app as any).log?.info(
        { sessionId },
        "POST /mcp/sse forwarded to transport",
      );
    } catch {}
  },
);

app.post(
  "/sse",
  async (
    req: FastifyRequest<{ Querystring: { sessionId?: string }; Body: unknown }>,
    reply: FastifyReply,
  ) => {
    const rawUrl = (req.raw as any)?.url as string | undefined;
    let sessionId: string = (extractSessionId(req) ?? "") as string;
    try {
      (app as any).log?.info(
        {
          rawUrl,
          parsedSessionId: sessionId,
          lastSessionId,
          size: sseSessions.size,
          keys: Array.from(sseSessions.keys()),
        },
        "POST /sse received",
      );
    } catch {}

    if (!sessionId) {
      const startedAt = Date.now();
      while (!sessionId && Date.now() - startedAt < 5000) {
        if (sseSessions.size === 1) {
          sessionId = Array.from(sseSessions.keys())[0] as string;
          break;
        }
        if (lastSessionId) {
          sessionId = lastSessionId as string;
          break;
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    }

    if (!sessionId && sseSessions.size === 1) {
      sessionId = Array.from(sseSessions.keys())[0] as string;
    }
    if (!sessionId && lastSessionId) {
      sessionId = lastSessionId as string;
    }
    if (!sessionId) {
      try {
        (app as any).log?.warn(
          { size: sseSessions.size, lastSessionId },
          "POST /sse no session available",
        );
      } catch {}
      return reply
        .code(503)
        .send({
          error: {
            code: "SSE_NOT_READY",
            message: "SSE connection not established",
            details: {},
          },
        });
    }
    const entry = sseSessions.get(sessionId);
    if (!entry) {
      try {
        (app as any).log?.warn(
          { sessionId, keys: Array.from(sseSessions.keys()) },
          "POST /sse unknown session",
        );
      } catch {}
      return reply
        .code(404)
        .send({
          error: {
            code: "NOT_FOUND",
            message: "Unknown SSE session",
            details: { sessionId },
          },
        });
    }
    await entry.transport.handlePostMessage(
      req.raw as any,
      reply.raw,
      (req as any).body,
    );
    try {
      (app as any).log?.info({ sessionId }, "POST /sse forwarded to transport");
    } catch {}
  },
);

// (HEAD auto-supported by Fastify for GET routes)

// (removed duplicate definitions)

const port = Number(process.env.PORT || 7777);
const host = String(process.env.HOST || "127.0.0.1");
app
  .listen({ port, host })
  .then(() => {
    app.log.info({ port }, "server started");
  })
  .catch((err) => {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  });

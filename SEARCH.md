Title: Find a free, stable, public HTTPS deployment pattern for multiple MCP SSE servers (no subpaths)

You are an expert infra/product engineer. Design the simplest, free solution to expose multiple local MCP servers over HTTPS with stable URLs that never change across restarts. Avoid any approach that relies on subpath routing for MCP SSE.

Context (current setup)
- Host: macOS (Mac mini). Admin access is available. Homebrew installed.
- Networking today: Tailscale is in use (Serve + Funnel already enabled on the Mac mini). We can also consider other free options if they meet constraints.
- Services (NodeJS):
  - Project Agent MCP server (this repo): Fastify HTTP server with SSE endpoints at `/sse` (alias `/mcp/sse`); listens on `HOST`/`PORT`. Health endpoints: `GET /health`, `GET /version`.
  - Twitter Scraper MCP server (separate repo): uses `fastmcp` and supports both stdio and SSE. Compiled entry at `dist/index.js`. SSE endpoint defaults to `/sse`; port via `PORT`.
- Process manager: launchd LaunchDaemons are used to run each service at boot, binding to `127.0.0.1:<port>` (fronted by a proxy/tunnel).
- Known behavior: MCP over SSE emits a POST endpoint path (e.g., `/sse` or `/messages`) that the client resolves at the origin root. Subpath proxies (e.g., mapping `/twitter -> 127.0.0.1:7781`) break POST routing (404), so the client shows “no tools”. Root-only origin per service is required.

Hard constraints (must satisfy all)
- HTTPS only: Endpoints must be valid HTTPS and accepted by Claude.
- No subpaths: MCP SSE must be served at the origin root (`/`), not under a path prefix.
- Stable URLs: Public URLs must not change across restarts.
- Public access: Reachable from external devices (e.g., phone on LTE), not just the local machine.
- Free: No ongoing cost solutions (free tiers are OK). Prefer zero-cost end-to-end.
- Multi-service: Support 2+ MCP servers now and more in the future, each with its own origin.
- Operational simplicity: Minimal moving parts, easy to operate and debug on macOS.

Non-starters (based on prior findings)
- Tailscale Funnel on a single device hostname: Provides one public HTTPS origin on port 443 for the device’s `*.ts.net` name. It supports path routing only. Since subpaths break MCP SSE, Funnel cannot host multiple MCP services under different paths on the same device hostname. It also does not expose multiple public HTTPS ports (e.g., `:7777`, `:7781`).
- Path prefixes with any proxy: Break SSE because the MCP client POSTs to the advertised endpoint at the origin root.
- Quick tunnels (trycloudflare/localtunnel/ngrok free): URLs change on restart → violates stable URL requirement.

Acceptable building blocks (if they meet constraints)
- Tailscale: Serve + Funnel; MagicDNS; possibility of multiple nodes/identities; per-node stable `*.ts.net` hostnames.
- Reverse proxy on the Mac (Caddy/Nginx): Can terminate TLS and route by hostname (not path) to local ports.
- Free public DNS: Any zero-cost hostname provider that supports ACME HTTP-01/ALPN-01 or is compatible with Cloudflare Tunnel (e.g., using an existing domain on Cloudflare free plan).
- Cloudflare Tunnel (free plan): Stable hostnames under your own domain; free if you already have a domain on Cloudflare.

What’s already working locally
- Each MCP server runs fine on its own local port and `127.0.0.1`.
- LaunchDaemons in place to keep them running.

Goals for your proposal
1) Produce 2+ stable public HTTPS origins, each mapping the origin root to one MCP server port (no subpaths).
2) Zero or minimal cost to run indefinitely.
3) Easy to add more MCP servers later with unique origins.
4) Clear, step-by-step macOS setup and ops instructions (install, start, verify, update).
5) Explicitly document how this avoids the SSE subpath issue.

Candidate directions to evaluate (not exhaustive)
- Multiple Tailscale nodes: Run each MCP inside its own container or VM with its own `tailscaled` identity. Enable `tailscale serve` + `tailscale funnel` in each node, yielding a unique, stable `*.ts.net` hostname per service. Validate tailnet/device limits and policy requirements (`funnel` attribute).
- Cloudflare Tunnel with existing domain: Map `agent.example.com` → `127.0.0.1:7777` and `twitter.example.com` → `127.0.0.1:7781` at the origin root. Uses stable DNS, free plan. Requires having a domain (domain may cost money; if a free domain is required, propose a truly free DNS option that works).
- Public reverse proxy on the Mac: Caddy/Nginx on ports 80/443 with Let’s Encrypt certs; two hostnames (from a free DNS provider) pointing to home IP with router port-forwarding 80/443 to the Mac mini. Ensure residential ISP allows it; describe dynamic DNS handling if IP changes.
- Other free static-origin options: If there are lesser-known providers that can give two stable, public, HTTPS origins and forward to local ports without subpaths or changing URLs, include and assess them.

Deliverables
- A prioritized recommendation (choose one) with rationale against constraints and trade-offs.
- A concrete implementation plan for the chosen option:
  - Exact commands, config files, and where they live on macOS.
  - How to obtain/assign the two stable hostnames.
  - How traffic reaches `127.0.0.1:7777` and `127.0.0.1:7781` at the origin root.
  - How to add a third MCP later with minimal steps.
  - Verification steps: curl checks for SSE headers, test via Claude, and how to spot/fix common failures.
  - Rollback plan.
- A brief appendix comparing at least two alternate options and explaining why they didn’t make the top spot (relative to constraints and ops simplicity).

Acceptance tests (must pass)
- Two stable public HTTPS URLs exist, one per MCP, e.g., `https://agent.<stable-domain-or-tsnet>/sse` and `https://twitter.<stable-domain-or-tsnet>/sse`.
- On restart of the Mac and services, the URLs remain the same and work.
- Claude Desktop can connect to each URL, shows tools, and can call at least one tool end-to-end.
- No subpath rewriting is used; each service owns the origin root it’s exposed on.

Notes about the services
- Project Agent: Fastify server, respects `HOST`, `PORT`, `READONLY`, optional TLS env vars; SSE endpoints at `/sse` and `/mcp/sse`; `GET /health` and `GET /version` are open.
- Twitter Scraper: `fastmcp`; SSE via `PORT` + `SSE_ENDPOINT=/sse`; requires Twitter credentials in env for tool calls.

Security and operations
- Keep services bound to `127.0.0.1` and place a TLS proxy/tunnel in front for public exposure. Avoid exposing raw Node servers directly to the internet.
- Rate limits and simple auth exist on Project Agent; Twitter Scraper may need proxy-level auth/rate limiting if exposed publicly (recommend minimal guardrails).
- Prefer solutions that can be operated via simple scripts or LaunchDaemons and don’t hang interactive sessions.

Output format
- Start with the chosen approach summary.
- Provide a step-by-step implementation with commands.
- Include a short “How to add another MCP server later” section.
- Include verification and troubleshooting.
- End with a compact comparison of alternatives.


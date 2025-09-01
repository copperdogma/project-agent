# Project Requirements

**START CRITICAL NOTES -- DO NOT REMOVE**
- This document focuses on WHAT the system should do and WHY, not HOW it should be implemented.
- Keep this document formatted according to `requitements-template.md`
- Record every single user-given requirements that get into HOW instead of WHY below in the `Non-Requirements Detail` section.
- Ask the user if they should transition to the next phase if:
    - If we have enought requirements for an MVP.
    - If the user is moving past basic requirements into HOW to achieve the project goals.
- `scratchpad.mdc` will explain which script to run to transition to the next phase.
**END CRITICAL NOTES -- DO NOT REMOVE**
# **MCP: Project Agent for Obsidian (Always-LLM, Direct Editor)**

## **Goals**
- Call a **local MCP server** that edits Markdown in your Obsidian vault.
- LLM sends natural instructions; **server returns deterministic ops + diff**.
- Prefer **Uncategorized at top** for new documents; for existing documents, **do not reorder sections**. Use Uncategorized as **fallback** when confidence < high.
- **Whitelist** only cam.marsollier@gmail.com (requests without this principal are rejected).

---

## **Security**
- Default to localhost (127.0.0.1). LAN access is opt-in and must use mTLS with a CIDR allowlist.
- **Auth options (pick one):**
    - **Mutual TLS** (recommended for production/default).
    - **Bearer token** in MCP connection metadata (dev convenience only).
- **Allowlist principal/email:** requests must include x-user-email: cam.marsollier@gmail.com.
- Path sandboxing: vault root is fixed; deny path traversal.
    
---

## **Vault Conventions**

Suggested sections and order (non-enforced):
1. Uncategorized → Tasks → Ideas → Resources → Notes → Log → Decisions

Line formats:
- Tasks: - [ ] <text> (YYYYMMDD) #tags ^id
- Others: YYYYMMDD ai: <text> [#tags] ^id
- Resources: - <title> — <url> [note] YYYYMMDD ai: [#tags] ^id

---

## **Configuration and Operational Behavior**

- Vault root: configure via `VAULT_ROOT` (absolute path). If not a git repo, initialize on first run.
- Git identity/messages: configurable via env (e.g., `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`). Defaults to `Project Agent <robot@local>`. Commit messages derive from ops summary and include slug and tool name.
- Allowlist principal/email: read `x-user-email` from MCP connection metadata; `EMAIL_OVERRIDE` may be used in development.
- Time and date: `TIMEZONE` defaults to `America/Edmonton`. All new lines must use date format `YYYYMMDD`.
- Snapshot context: include last `SNAPSHOT_TAIL` lines per section (default 10).
- Limits: snapshot payload ≤ 256 KB; ≤ 128 ops per call; each line ≤ 16 KB.
- Anchors: 6–8 base36 characters; collisions suffixed with `-b`.
- Missing anchors: update/delete/move_by_anchor on missing anchor returns an error and performs no write.
- Move semantics: moving within the same section places the line(s) at the section tail.
- Update semantics: `replace_with_lines` may contain one or more lines. Perform minimal format validation per section and warn on soft violations.
- Dedup policy: deduplicate by exact text or by normalized URL plus trimmed text; prefer existing anchor.
- Locking: use per-file lockfiles during writes.
- Registry: store at `<VAULT_ROOT>/.project-agent/projects.yaml` and auto-add entries on create.
- Create defaults: for new documents, write under `Projects/<Title>.md` and use the provided `initial_sections`. Existing documents are not reorganized.
- Port/config: default `PORT=7777`; configuration via `.env` (dotenv). TLS cert/key paths set via env.
- Fixtures: include an `example-vault/` for tests and CI; switchable via `VAULT_ROOT`.

---

## **Tooling (MCP Tools)**


### **1)** 

### **project.snapshot**


**Purpose:** Give the LLM enough context without sending the whole file.
- **input:** { slug: string }
- **output:**

```
{
  "frontmatter": {"title":"...", "slug":"...", "router_email":"qroutai+<slug>@gmail.com"},
  "toc": ["Uncategorized","Tasks","Ideas","Resources","Notes","Log","Decisions"],
  "per_section_tail": { "Uncategorized": ["..."], "Tasks": ["..."], ... },
  "anchors_index": { "^abc123": {"section":"Resources","excerpt":"- React 19 — ..."} },
  "recent_ops": ["20250831 +Resources(1)"],
  "current_commit": "abcd123",
  "date_local": "YYYYMMDD",
  "tz": "America/Edmonton"
}
```

### **2)** 

### **project.getDocument**

**Purpose:** Return the full Markdown document for a project.
- **input:** { slug: string }
- **output:**

```
{
  "frontmatter": {"title":"...", "slug":"...", "router_email":"qroutai+<slug>@gmail.com"},
  "content": "# Full markdown contents including all sections...",
  "path": "Projects/Storybook Agent.md",
  "size_bytes": 12345,
  "current_commit": "abcd123",
  "date_local": "YYYYMMDD",
  "tz": "America/Edmonton"
}
```
 
    
### **3)** 
 
### **project.applyOps**  

**Purpose:** Deterministically apply LLM-planned ops and return a diff.
- **input:**

```
{
  "slug": "storybook",
  "ops": [
    {"op":"append","section":"Resources","lines":["- Title — URL 20250831 ai: ^r1"]},
    {"op":"move_by_anchor","anchor":"^abc123","to_section":"Ideas"},
    {"op":"update_by_anchor","anchor":"^t9u7w0","replace_with_lines":["- [ ] ... ^t9u7w0"]},
    {"op":"delete_by_anchor","anchor":"^deadbe"}
  ],
  "expected_commit": "abcd123",            // optional optimistic concurrency
  "idempotency_key": "random-uuid-123"     // optional safe-retry key
}
```
 
- **behavior:** preserve existing section order (no reordering). Create sections if missing when referenced, never touch lines without anchors, apply per-file locking, and commit via git. 
- **output:** { "commit": "abcd123", "summary": "+Resources(1), move(1)", "diff": "unified diff…" , "primary_anchors": ["^r1"] }
  

### **4)** 

### **project.create**

**Purpose:** New project from scratch.
- **input:**

```
{ "title":"Storybook Agent", "slug":"storybook-agent", "initial_sections": {
  "Uncategorized": ["20250831 ai: Project initialized. ^u0001"],
  "Notes": ["20250831 ai: Summary: ... ^n0001"],
  "Resources": ["- Original thread — <url> 20250831 ai: ^r0001"],
  "Log": ["20250831 ai: Initialized project and registry. ^l0001"]
}}
```
    
- **output:** { "path":"Projects/Storybook Agent.md", "commit":"abcd123" }


### **5)**

### **project.list**
  
**Purpose:** Lookup/route.
- **input:** {}
- **output:** from projects.yaml:

```
[{ "title":"Skulls", "slug":"skulls", "path":"Projects/Skulls.md" }, ...]
```


### **6)** 

### **project.undo**  

**Purpose:** Revert by commit or op-id.
- **input:** { "commit":"abcd123" }
- **output:** { "revert_commit":"beef456", "diff":"..." }
    

### **7)** 

### **project.previewPlan**
### **8)**

### **server.health**

**Purpose:** Operational readiness and uptime.
- **input:** {}
- **output:** { "status":"ok", "uptime_s":12345 }

### **9)**

### **server.version**

**Purpose:** Versioning and compatibility.
- **input:** {}
- **output:** { "app":"project-agent", "version":"0.1.0", "schema":"2025-09-01" }

### **10)**

### **project.search** (post-MVP)

**Purpose:** Find anchors/sections/lines by query without fetching the full document.
- **input:** { "slug":"skulls", "query":"MG996R", "scope":"all|section", "section?":"Notes" }
- **output:** { "matches":[ {"section":"Notes","anchor":"^mg996t","excerpt":"..."} ] }


###  **(optional)**

**Purpose:** Dry-run validation of ops without writing.
- **input:** { "slug":"skulls", "ops":[...]}
- **output:** { "ok":true, "would_change": true, "notes":[] }
    
---

## **LLM Contract (inside your ChatGPT "Project" system prompt)**

- Always call:
    1. project.snapshot(slug). If full context is needed, call project.getDocument(slug).
    2. Produce **JSON ops** plan (append/move/update/delete/create_project) using the snapshot.
    3. Call project.applyOps (or project.create) and return the **diff/summary**.
    
- If content is ambiguous/low-confidence, **route to Uncategorized** (top).
    
- Every added/updated line must include date prefix and a unique anchor ^id (6–8 base36).
    (Server will suffix -b if collision.)
    
- Avoid duplicates: if URL/text already exists (via anchors_index / tail scan), prefer a dedup (no write).

### Error Model

All tools return either a successful payload or an error object:

```
{ "error": { "code": "FORBIDDEN_EMAIL", "message": "...", "details": {"hint":"..."} } }
```

Canonical error codes: `UNAUTHORIZED`, `FORBIDDEN_EMAIL`, `NOT_FOUND_ANCHOR`, `VALIDATION_ERROR`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `READ_ONLY`, `INTERNAL`.

**LLM-side JSON plan shape (identical to earlier spec):**

```
{
  "project": {"action":"use_existing","title":"Skulls","slug":"skulls"},
  "ops": [
    {"op":"append","section":"Uncategorized","lines":["20250831 ai: React 19 — https://… ^r19a7c"]},
    {"op":"append","section":"Notes","lines":["20250831 ai: Summary: … ^sum123"]}
  ]
}
```

---

## **Minimal Server (Node/TS) outline**

- src/security.ts — auth (mTLS or bearer), email allowlist check.
- src/vault.ts — safe path resolver, load/save, file locking.
- src/sections.ts — read and preserve existing section order; provide helpers for suggested order when creating new documents (Uncategorized first on create only).
- src/snapshot.ts — build snapshot (tails, anchors, ops log) in existing order.
- src/document.ts — return full document contents for project.getDocument.
- src/apply.ts — ops engine (append/move/update/delete), anchor collision check.
- src/git.ts — simple-git commit + show diff.
- src/registry.ts — projects.yaml CRUD.
- src/server.ts — MCP transport + tool registration.

---

## **Example Calls (Chat flow)**

**User:** "add this to the skulls project: implement this next — MG996R datasheet https://…"

1. Tool: project.snapshot({slug:"skulls"})
2. LLM plans:

```
{"ops":[
  {"op":"append","section":"Tasks","lines":["- [ ] Evaluate MG996R current vs 5V rail (20250831) #servo ^mg996t"]}
]}
```

3. Tool: project.applyOps({...}) → returns commit + diff to show user.

**User:** "Great. Create a new project doc for this."

1. Tool: project.create({...}) with initial_sections per spec.
2. Return path+commit+diff.

---

## **Acceptance (MCP-specific)**

1. **Auth enforced:** calls without allowlisted email rejected.
2. **No section reordering:** existing documents retain their section order; new documents use suggested order with Uncategorized first.
3. **Date format:** all new lines use YYYYMMDD.
4. **Idempotent anchors:** re-applying same append is deduped by anchor/text; collisions suffixed with -b.
5. **Create+apply:** fresh project created with required sections and formats; existing documents are not mutated structurally.
6. **Undo:** project.undo reverts prior commit cleanly.
7. **Full document access:** project.getDocument returns the entire Markdown with frontmatter and content.
8. **Optimistic concurrency:** applyOps rejects stale writes when `expected_commit` mismatches the latest commit.
9. **Idempotency:** repeated applyOps with the same `idempotency_key` are safe no-ops.
10. **Read-only mode:** when `READONLY=true`, write tools return `READ_ONLY`.
11. **Auditing:** every write produces an audit entry (timestamp, email, slug, summary, commit).
12. **Rate limiting:** write operations are throttled per email and per slug per configured limits.
13. **Error model:** tools return standardized error codes and structures.

---

## **Why MCP over email**

- Lower friction: no forwarding, no subject games.
- Immediate tool calls + diffs in the same chat turn.
- Works across any MCP-aware client, not just one vendor's email pipeline.

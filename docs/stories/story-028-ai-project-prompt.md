# Story: AI Project system prompt + tool overview

**Status**: To Do

---

## Related Requirement

[AI Project usage; System prompt for MCP-backed workflows; Tooling overview]

## Alignment with Design

[Design: Deterministic edits; Client ergonomics; Error model; Limits]

## Acceptance Criteria

- Produce a single `AI_PROJECT_PROMPT.md` at repo root that:
  - Instructs the AI to accept user-provided inputs (text, links/URLs, brief notes), optionally summarize/analyze, then file into the correct project and section.
  - Specifies discovery flow: use `project_list` and `project_search` to identify the intended project; confirm ambiguity with the user when confidence is low.
  - Specifies section choice rules: prefer explicit user instruction; otherwise default to `Uncategorized` when uncertain; never reorder sections.
  - Specifies planned call flow (snapshot-first): `project_snapshot` (or `project_get_document` when necessary) → plan ops (append/update/move/delete) in JSON → optional `project_preview` (for risky/large changes) → write tool(s) with `expectedCommit` when appropriate → show diff/summary → (optional) `project_undo` if requested.
  - Documents tool behaviors and constraints succinctly: date prefix `YYYYMMDD`, anchors (6–8 base36, `-b` on collisions), dedup policy, line-length and payload limits, rate limiting, read-only mode.
  - Details optional parameter usage with camelCase (`expectedCommit`, `idempotencyKey`) as non-empty strings; avoid explicit nulls; switch to raw JSON if UI hides fields.
  - Specifies error handling: parse JSON text, map canonical error codes (VALIDATION_ERROR, NOT_FOUND_ANCHOR, CONFLICT, PAYLOAD_TOO_LARGE, RATE_LIMITED, READ_ONLY), explain to the user and suggest next steps.
  - Encourages safe defaults: use `project_preview` before destructive operations; ask for confirmation when ambiguous; route uncertain content to `Uncategorized`.
  - Provides a compact tool overview (one-liners for each public tool) and 2–3 example sequences (e.g., add link to project X; update by anchor; move item between sections).
- Prompt must be concise, actionable, and copy-paste ready for Claude/ChatGPT/Gemini Projects.
- Does not include repository-specific secrets or environment assumptions; references environment-driven behaviors (READONLY, limits) at a high level only.

## Tasks

- [ ] Draft the `AI_PROJECT_PROMPT.md` content covering intent, discovery, planning, execution, and error handling.
- [ ] Add a public tool overview section with usage tips and optional parameter guidance.
- [ ] Add 2–3 example workflows (input → tool calls → expected outcomes).
- [ ] Review tone and length for project system prompts (concise yet comprehensive).
- [ ] User sign-off; then add the file at repo root.

## Notes

- Do not create `AI_PROJECT_PROMPT.md` yet; complete this story first to capture requirements and scope.
- Public tools to reference: `server_health`, `server_version`, `project_list`, `project_snapshot`, `project_get_document`, `project_create`, `project_append`, `project_update_by_anchor`, `project_move_by_anchor`, `project_delete_by_anchor`, `project_undo`, `project_preview`, `project_search`.


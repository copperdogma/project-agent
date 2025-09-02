# Scratchpad - Requirements Phase

**Current Phase**: MVP Requirements Gathering

**MVP Checklist**

- [ ] Define core problem and purpose:
  - [ ] Who are the target users?
  - [ ] What problem does this solve for them?
  - [ ] How will users measure success?
- [ ] Identify MVP features (must-haves only):
  - [ ] Core functionality (1-3 key capabilities)
  - [ ] Critical constraints or requirements
  - [ ] Minimum user journey/flow
- [ ] Separate nice-to-haves from essentials:
  - [ ] Future enhancements (post-MVP)
  - [ ] Stretch goals
- [ ] Document in `/docs/requirements.md`:
  - [ ] Clear MVP definition
  - [ ] Prioritized feature list
  - [ ] User stories for core flows
  - [ ] Any non-requirements details or outstanding questions in the "Non-Requirements Detail" section at the bottom

**Project Type Selection**

- [ ] Determine appropriate project type:
  - [ ] Review available types in `/bootstrapping/project-types/`
  - [ ] Analyze options:
    - [ ] Programming: For software development projects
    - [ ] Research: For research-oriented projects
    - [ ] [Other types as available]
  - [ ] Provide rationale for recommendation
- [ ] Present options with clear descriptions
- [ ] If user discusses implementation details prematurely:
  - [ ] Document these in the "Non-Requirements Detail" section at the bottom of requirements.md for later
  - [ ] Guide back to project type selection first
- [ ] Get explicit confirmation of project type choice

**Ready to Build?**

- When the MVP is clearly defined and project type selected, ask:
  "I think we have enough requirements for an MVP version of the project. Would you like to start building with the [selected_project_type] project type?"
- If yes, run: `./bootstrapping/scripts/transition_to_execute.sh [project_type]`
  - Then read the new scratchpad.mdc and scratchpad.md and follow the new instructions.

## User Input

Full requirements pasted into `docs/requirements.md` describing an MCP-based local server to edit Obsidian vault Markdown with deterministic ops and diffs, canonical sections, anchors, and security constraints.

## Issues or Blockers

## Outstanding Questions

- Auth: Prefer mTLS or Bearer token for MVP? If mTLS, should we generate self-signed certs and provide a script?
- Network scope: localhost only, or allow LAN clients? If LAN, which CIDRs are allowed?
- Vault: Absolute path to the Obsidian vault root? Is the vault already a git repo?
- Git: Commit author/email to use and preferred commit message format (e.g., summary from ops)?
- MCP client: Which MCP-aware client will call these tools? Confirm how to pass `x-user-email` metadata.
- Timezone/date: Confirm `America/Edmonton` and `YYYY-MM-DD` as the canonical format for all new lines.
- Snapshot tails: How many tail lines per section should `per_section_tail` include (e.g., 10)?
- Size limits: Any max payload size for snapshot/ops to enforce?
- Anchors: 6–8 base36 characters—okay to auto-suffix `-b` on collision as spec states?
- Update behavior: If an anchor is missing, should we error the op or skip with a note?
- Move semantics: When moving within the same section, should we place at tail, or preserve relative order with a specific position?
- Update semantics: `replace_with_lines` may include 1+ lines—acceptable? Any line-format validation required by server?
- Dedup policy: Exact-text match only, or normalize whitespace/URLs when deduping?
- Locking: Is an advisory per-file lock (e.g., lockfile) acceptable for MVP?
- Registry: Location and schema for `projects.yaml` (path and sample)? Auto-add on create?
- Create defaults: Use the provided `initial_sections` exactly? Base folder for files (e.g., `Projects/Title.md`)?
- Acceptance scope: For MVP, are all tools required (`snapshot`, `applyOps`, `create`, `list`, `undo`, `previewPlan`), or can `previewPlan` be post-MVP?
- Port/config: Preferred port and config mechanism (env vars in `.env`)?
- Fixtures: Provide a sample vault to develop/test against, or should we scaffold one?
- Migration: For existing lines without anchors, should server refuse edits or inject anchors on first touch?
- Frontmatter: Confirm expected keys in snapshot (`title`, `slug`, `router_email`) and whether server should add missing frontmatter.
- Sections: Confirm canonical list and fixed order: Uncategorized, Tasks, Ideas, Resources, Notes, Log, Decisions.
- Encoding: Confirm UTF-8 with LF line endings.

## Proposed Decisions (Recommendations)

- Auth: Use mutual TLS for MVP (best security). Provide optional bearer token dev-mode via env toggle.
- Network scope: Default localhost-only. Allow opt-in LAN with CIDR allowlist (env: ALLOW_CIDRS).
- Vault path: Require absolute path via VAULT_ROOT env. If not a git repo, initialize on first run.
- Git identity/messages: Use env overrides; fallback `Project Agent <robot@local>`. Message: summary from ops, include slug and tool.
- MCP client/metadata: Target MCP clients supporting connection metadata; read `x-user-email` from metadata, fallback to EMAIL_OVERRIDE env for dev.
- Time/date: Default TIMEZONE=America/Edmonton. Enforce YYYYMMDD for all writes.
- Snapshot tails: Include last 10 lines per section (configurable via SNAPSHOT_TAIL=10).
- Size limits: Max snapshot payload 256 KB; max ops per call 128; max line length 16 KB.
- Anchors: 6–8 base36; auto-suffix `-b` on collision.
- Missing anchors: For update/delete/move_by_anchor, return 404-like error; no-op with clear message.
- Move semantics: When moving within the same section, place at tail (simple, deterministic).
- Update semantics: `replace_with_lines` supports 1+ lines. Validate minimal format per section; warn on soft violations.
- Dedup policy: Dedup by exact text OR normalized URL+trimmed text; prefer existing anchor if duplicate.
- Locking: Per-file lockfile during write (advisory lock).
- Registry: Store at `<VAULT_ROOT>/.project-agent/projects.yaml`. Auto-add on create.
- Create defaults: Use provided `initial_sections` exactly. Base path `Projects/<Title>.md` under VAULT_ROOT.
- Tool scope (MVP): Implement snapshot, applyOps, create, list, undo. Defer previewPlan to post-MVP.
- Port/config: Default PORT=7777, config via .env (dotenv). TLS cert/key paths via env.
- Fixtures: Ship `example-vault/` for tests and CI; toggleable via VAULT_ROOT.
- Migration: Do not auto-annotate existing files. Provide CLI `migrate:add-anchors` utility; refuse ops targeting lines without anchors.
- Frontmatter: Ensure on create; do not modify existing unless explicit; include title, slug, router_email.
- Sections: Enforce canonical list and fixed order as specified.
- Encoding: Enforce UTF-8 with LF.

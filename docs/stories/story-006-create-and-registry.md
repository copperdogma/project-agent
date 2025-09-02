# Story: Create tool + registry

**Status**: Done

---

## Related Requirement

[Tooling: project.create, project.list; Registry]

## Alignment with Design

[Design: Configuration; Workflow]

## Acceptance Criteria

- project.create writes new doc under Projects/<Title>.md with initial sections.
- Registry file exists at .project-agent/projects.yaml; list returns entries.
- New document includes frontmatter (title, slug, router_email).
- [x] User must sign off on functionality before story can be marked complete.

## Tasks

- [x] Implement initial_sections write with YYYYMMDD.
- [x] Implement registry CRUD and unique slug enforcement.
- [x] Implement project.list and reference from registry.

## Notes

- Do not reorganize existing docs.

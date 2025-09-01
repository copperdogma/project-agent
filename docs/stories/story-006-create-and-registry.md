# Story: Create tool + registry

**Status**: To Do

---

## Related Requirement
[Tooling: project.create, project.list; Registry]

## Alignment with Design
[Design: Configuration; Workflow]

## Acceptance Criteria
- project.create writes new doc under Projects/<Title>.md with initial sections.
- Registry file exists at .project-agent/projects.yaml; list returns entries.
 - New document includes frontmatter (title, slug, router_email).
- [ ] User must sign off on functionality before story can be marked complete.

## Tasks
- [ ] Implement initial_sections write with YYYYMMDD.
- [ ] Implement registry CRUD and unique slug enforcement.
- [ ] Implement project.list and reference from registry.

## Notes
- Do not reorganize existing docs.

---
name: update-installation-and-compatibility-documentation
description: Workflow command scaffold for update-installation-and-compatibility-documentation in kibana-mcp-server.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-installation-and-compatibility-documentation

Use this workflow when working on **update-installation-and-compatibility-documentation** in `kibana-mcp-server`.

## Goal

Improves or updates installation instructions and compatibility/support documentation, often across multiple docs and README files.

## Common Files

- `INSTALL.md`
- `README.md`
- `docs/project/compatibility-matrix.md`
- `docs/project/support-policy.md`
- `plugins/*/skills/install-and-configure/SKILL.md`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Edit INSTALL.md and/or README.md
- Update docs/project/compatibility-matrix.md and docs/project/support-policy.md
- Update or add plugin-specific install/configure documentation

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
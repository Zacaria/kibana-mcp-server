---
name: update-package-metadata-and-release-preparation
description: Workflow command scaffold for update-package-metadata-and-release-preparation in kibana-mcp-server.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /update-package-metadata-and-release-preparation

Use this workflow when working on **update-package-metadata-and-release-preparation** in `kibana-mcp-server`.

## Goal

Prepares the package for release by updating package metadata, documentation, and release/checklist files, often in conjunction with changeset files and test updates.

## Common Files

- `.changeset/*.md`
- `README.md`
- `docs/project/distribution-strategy.md`
- `docs/project/npm-publishing.md`
- `docs/project/release-checklist.md`
- `package.json`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Update or add .changeset/*.md files
- Modify README.md and relevant documentation under docs/project/
- Update package.json (and sometimes package-lock.json)
- Adjust or add .github/workflows/release.yml
- Update or add test files related to package contracts

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.
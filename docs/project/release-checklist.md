---
title: Release Checklist
status: active
updated: 2026-04-06
---

# Release Checklist

## Preconditions

- CI is green on `master`.
- `npm run verify` passes locally.
- The compatibility matrix is up to date (`docs/project/compatibility-matrix.md`).
- Any new env or config requirements are documented in `README.md` and `INSTALL.md`.

## Release Authorization

- Releases are created via the `Release` GitHub Actions workflow.
- Tags and release PR merges require maintainer approval.
- Only maintainers listed in `CODEOWNERS` should have permission to trigger releases.

## Security Posture for CI/Release

- Workflow permissions must be minimal (`contents: read` for CI, `contents: write` + `pull-requests: write` for release PRs).
- Publishing to npm must use OIDC trusted publishing when enabled.
- Do not store long-lived npm tokens in repo secrets.

## Threat Model (Top 3)

1. **Compromised GitHub Actions workflow**: mitigate with minimal permissions, required reviews, and avoiding untrusted actions.
2. **Malicious dependency update**: mitigate with dependency review workflow and human review of automated PRs.
3. **Accidental secrets leakage in artifacts**: mitigate with `verify-packlist` and explicit exclusion of local config files.

## Steps

1. Create or update Changeset(s).
2. Run `npm run verify`.
3. Merge the Changesets release PR.
4. Confirm the generated changelog and version bump.
5. If publishing is enabled, run the publish job and validate the package contents.

## Post-Release

- Confirm install instructions still match the shipped artifact.
- Update any compatibility claims that changed in the release.

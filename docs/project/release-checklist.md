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
- The npm scope and package name (`@zacaria/kibana-mcp-server`) are owned by the maintainers.

## Release Authorization

- Releases are created via the `Release` GitHub Actions workflow.
- Trusted publishing for npm must point at workflow file `release.yml`.
- Tags and release PR merges require maintainer approval.
- Only maintainers listed in `CODEOWNERS` should have permission to trigger releases.

## Security Posture for CI/Release

- Workflow permissions must be minimal (`contents: read` for CI, `contents: write` + `pull-requests: write` + `id-token: write` for release PRs and publish).
- Publishing to npm must use OIDC trusted publishing.
- Do not store long-lived npm tokens in repo secrets.
- After trusted publishing is verified, disallow token-based publishing in npm package settings.

## Threat Model (Top 3)

1. **Compromised GitHub Actions workflow**: mitigate with minimal permissions, required reviews, and avoiding untrusted actions.
2. **Malicious dependency update**: mitigate with dependency review workflow and human review of automated PRs.
3. **Accidental secrets leakage in artifacts**: mitigate with `verify-packlist` and explicit exclusion of local config files.

## Steps

1. Create or update Changeset(s).
2. Run `npm run verify`.
3. Confirm the npm package identity is publishable by this maintainer account.
4. Configure npm trusted publishing for `release.yml`.
5. Merge the Changesets release PR.
6. Confirm the generated changelog and version bump.
7. Validate the published package contents and provenance.

## Post-Release

- Confirm install instructions still match the shipped artifact.
- Update any compatibility claims that changed in the release.

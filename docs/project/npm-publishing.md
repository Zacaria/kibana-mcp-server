---
title: npm Publishing Setup
status: active
updated: 2026-04-06
---

# npm Publishing Setup

This repo is prepared for npm trusted publishing from GitHub Actions, but npm-side setup is still required before the first successful publish.

## Current Blocker

The unscoped package name `kibana-mcp-server` is already published by another maintainer account. That means this repository cannot enable trusted publishing for that package name unless one of the following happens:

- the current package owner transfers ownership to the maintainers of this repo
- the project switches to a package name or scope controlled by this repo's maintainer account

Do not configure trusted publishing against a package you do not control.

## Repo-Side Publish Workflow

The authoritative workflow file is `.github/workflows/release.yml`.

It is responsible for:

- creating Changesets release PRs on normal `master` pushes
- publishing to npm automatically after a Changesets release PR is merged
- using GitHub OIDC instead of npm automation tokens

## npm-Side Setup

After package ownership is resolved:

1. Open the package settings on npmjs.com.
2. Add a trusted publisher.
3. Choose GitHub Actions.
4. Set:
   - Organization or user: `Zacaria`
   - Repository: `kibana-mcp-server`
   - Workflow filename: `release.yml`
   - Environment name: leave blank unless GitHub environments are added later
5. Save the trusted publisher.
6. Publish a release through the normal Changesets flow.
7. After the first successful publish, disable token-based publishing in npm package settings.

## Publish Expectations

- The workflow requires GitHub-hosted runners.
- The workflow requires `id-token: write`.
- The package must remain public for provenance to be generated automatically.
- The package `repository` field must match this public GitHub repository exactly.

```markdown
# kibana-mcp-server Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches the core development conventions and workflows used in the `kibana-mcp-server` TypeScript codebase. You'll learn file and code organization, commit standards, documentation and release preparation, and how to contribute effectively by following the repository's established patterns.

## Coding Conventions

**File Naming**
- Use **kebab-case** for all file names.
  - Example: `my-feature-file.ts`

**Import Style**
- Use **relative imports** for internal modules.
  - Example:
    ```typescript
    import { myFunction } from './utils/my-function';
    ```

**Export Style**
- Prefer **named exports** over default exports.
  - Example:
    ```typescript
    // utils/my-function.ts
    export function myFunction() { /* ... */ }
    ```

**Commit Messages**
- Use **Conventional Commits** with prefixes like `chore`, `feat`, or `docs`.
  - Example: `feat: add support for custom plugin loading`

## Workflows

### Update Package Metadata and Release Preparation

**Trigger:** When preparing for a release, updating package metadata, or changing npm publishing configuration.  
**Command:** `/prepare-release`

1. Update or add changeset files in `.changeset/*.md` to document changes.
2. Modify `README.md` and relevant documentation under `docs/project/` as needed.
3. Update `package.json` (and `package-lock.json` if dependencies change).
4. Adjust or add `.github/workflows/release.yml` for CI/CD release steps.
5. Update or add test files related to package contracts (e.g., `test/package_contract.test.ts`).

**Example:**
```bash
# Add a changeset
npx changeset

# Edit documentation
vim docs/project/release-checklist.md

# Update package metadata
npm version minor
```

### Update Installation and Compatibility Documentation

**Trigger:** When clarifying, improving, or updating installation and compatibility documentation for users.  
**Command:** `/update-docs`

1. Edit `INSTALL.md` and/or `README.md` to reflect latest installation steps.
2. Update `docs/project/compatibility-matrix.md` and `docs/project/support-policy.md` as needed.
3. Update or add plugin-specific install/configure documentation, such as `plugins/*/skills/install-and-configure/SKILL.md`.

**Example:**
```bash
# Edit installation instructions
vim INSTALL.md

# Update compatibility matrix
vim docs/project/compatibility-matrix.md
```

## Testing Patterns

- Test files use the pattern `*.test.*` (e.g., `my-feature.test.ts`).
- The testing framework is **unknown** from analysis, but tests are colocated with code or in a `test/` directory.
- Example test file:
  ```typescript
  // test/my-feature.test.ts
  import { myFunction } from '../src/utils/my-function';

  describe('myFunction', () => {
    it('should return true', () => {
      expect(myFunction()).toBe(true);
    });
  });
  ```

## Commands

| Command          | Purpose                                                      |
|------------------|--------------------------------------------------------------|
| /prepare-release | Prepare package metadata, documentation, and release files   |
| /update-docs     | Update installation and compatibility documentation          |
```
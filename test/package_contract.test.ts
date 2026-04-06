import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

describe("package contract", () => {
  it("publishes the intended artifact surface", () => {
    const pkgRaw = readFileSync(resolve(repoRoot, "package.json"), "utf8");
    const pkg = JSON.parse(pkgRaw) as { files?: string[]; main?: string };

    expect(pkg.main).toBe("dist/src/index.js");
    expect(pkg.files).toBeDefined();
    if (!pkg.files) {
      return;
    }

    const required = [
      "dist/**",
      "plugins/kibana-log-investigation/.mcp.json",
      "plugins/kibana-log-investigation/.codex-plugin/plugin.json",
      "README.md",
      "LICENSE",
      "CHANGELOG.md",
    ];

    for (const entry of required) {
      expect(pkg.files).toContain(entry);
    }
  });
});

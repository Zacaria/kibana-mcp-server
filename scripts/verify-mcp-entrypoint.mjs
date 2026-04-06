import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const mcpConfigPath = resolve(repoRoot, "plugins/kibana-log-investigation/.mcp.json");
const packageJsonPath = resolve(repoRoot, "package.json");

const raw = await readFile(mcpConfigPath, "utf8");
const config = JSON.parse(raw);
const server = config?.mcpServers?.["kibana-log-investigation"];

if (!server?.args?.length) {
  throw new Error("MCP config missing args for kibana-log-investigation.");
}

const entrypoint = resolve(repoRoot, server.args[0]);

if (!existsSync(entrypoint)) {
  throw new Error(`Expected MCP entrypoint missing: ${entrypoint}`);
}

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const expectedPath = "dist/src/index.js";
const packageBin = packageJson?.bin?.["kibana-mcp-server"];

if (packageJson?.main !== expectedPath) {
  throw new Error(`package.json main must be ${expectedPath}. Received: ${packageJson?.main}`);
}

if (packageBin !== expectedPath) {
  throw new Error(
    `package.json bin.kibana-mcp-server must be ${expectedPath}. Received: ${packageBin}`,
  );
}

if (packageJson?.scripts?.start !== `node ${expectedPath}`) {
  throw new Error(
    `package.json start must be "node ${expectedPath}". Received: ${packageJson?.scripts?.start}`,
  );
}

const builtEntrypoint = await readFile(entrypoint, "utf8");
if (!builtEntrypoint.startsWith("#!/usr/bin/env node")) {
  throw new Error("Built package entrypoint must start with a Node shebang for npm bin execution.");
}

console.log(`MCP entrypoint verified: ${entrypoint}`);

#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/server";

import { loadConfigFromEnvironment } from "./config.js";
import { createApplication } from "./server.js";

function hasBootstrapConfig(env: NodeJS.ProcessEnv): boolean {
  return Boolean(env.KIBANA_BASE_URL && env.KIBANA_USERNAME && env.KIBANA_PASSWORD);
}

async function main(): Promise<void> {
  let config = undefined;
  try {
    config = await loadConfigFromEnvironment();
  } catch (error) {
    if (hasBootstrapConfig(process.env)) {
      throw error;
    }
  }

  const { server } = createApplication(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

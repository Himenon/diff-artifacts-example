#!/usr/bin/env node

import { execMaskBuildId, readBuildId } from "./core.ts";

const CLI_HELP = `Usage: node scripts/mask-build-id.ts <target-directory> --build-id <path-to-BUILD_ID-file>

Examples:
  node scripts/mask-build-id.ts .next --build-id .next/BUILD_ID
`;

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): { targetDir: string; buildIdPath: string } | null {
  if (args.length < 3) {
    return null;
  }

  const targetDir = args[0];
  let buildIdPath: string | undefined;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--build-id" && i + 1 < args.length) {
      buildIdPath = args[i + 1];
      i++;
    }
  }

  if (!buildIdPath) {
    return null;
  }

  return { targetDir, buildIdPath };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);
  if (!parsed) {
    console.error(CLI_HELP);
    process.exit(1);
  }
  const buildId = await readBuildId(parsed.buildIdPath);
  if (!buildId) {
    throw new Error("BUILD_ID is empty");
  }
  await execMaskBuildId(buildId, parsed.targetDir, parsed.buildIdPath);
}

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith("mask-build-id.ts")) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}

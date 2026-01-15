#!/usr/bin/env node
/**
 * BUILD_ID Masking Tool
 *
 * Replaces all occurrences of BUILD_ID string with ${BUILD_ID} template string
 * in all files within the specified directory (recursively).
 *
 * Usage:
 *   node scripts/mask-build-id.ts <target-directory> --build-id <path-to-BUILD_ID-file>
 *   node scripts/mask-build-id.ts .next --build-id .next/BUILD_ID
 */

import { readFile, writeFile } from "node:fs/promises";
import { glob } from "glob";
import { relative } from "node:path";

/**
 * Read BUILD_ID file
 */
async function readBuildId(buildIdPath: string): Promise<string> {
  console.log(`Reading BUILD_ID from: ${buildIdPath}`);
  const content = await readFile(buildIdPath, "utf-8");
  return content.trim();
}

/**
 * Replace BUILD_ID in content
 */
function replaceBuildId(content: string, buildId: string): string {
  const escapedBuildId = buildId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedBuildId, "g");
  return content.replace(regex, "${BUILD_ID}");
}

/**
 * Process a single file
 */
async function maskFileContentByBuildId(filePath: string, buildId: string): Promise<void> {
  const content = await readFile(filePath, "utf-8");
  if (!content.includes(buildId)) {
    return;
  }
  const modifiedContent = replaceBuildId(content, buildId);
  await writeFile(filePath, modifiedContent, "utf-8");
  console.info(`✨️ ${relative(process.cwd(), filePath)}`);
}

/**
 * Mask BUILD_ID in all files
 */
async function execMaskBuildId(buildId: string, targetDir: string): Promise<void> {
  console.log(`BUILD_ID: ${buildId}`);
  console.log(`Scanning directory: ${targetDir}`);

  // 1. Get all files with glob
  const files = await glob("**/*", {
    cwd: targetDir,
    absolute: true,
    nodir: true,
    ignore: ["**/.git/**", "**/node_modules/**"],
  });

  console.log(`\nFound ${files.length} files to process`);

  // 2. Process all files in parallel, ignoring errors
  await Promise.all(
    files.map((file) =>
      maskFileContentByBuildId(file, buildId).catch((error) => {
        console.error(`Error processing ${file}: ${error.message}`);
      }),
    ),
  );

  console.log("\n✓ Completed");
}

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

const CLI_HELP = `Usage: node scripts/mask-build-id.ts <target-directory> --build-id <path-to-BUILD_ID-file>

Examples:
  node scripts/mask-build-id.ts .next --build-id .next/BUILD_ID
`;

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
  await execMaskBuildId(buildId, parsed.targetDir);
}

export { execMaskBuildId as maskBuildId, replaceBuildId };

// Run if executed directly
if (process.argv[1] && process.argv[1].endsWith("mask-build-id.ts")) {
  main();
}

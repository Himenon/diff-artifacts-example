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
export async function readBuildId(buildIdPath: string): Promise<string> {
  console.log(`Reading BUILD_ID from: ${buildIdPath}`);
  const content = await readFile(buildIdPath, "utf-8");
  return content.trim();
}

/**
 * Replace BUILD_ID in content
 */
export function replaceBuildId(content: string, buildId: string): string {
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
  console.info(`✨️ ${relative(process.cwd(), filePath)}`);
  await writeFile(filePath, modifiedContent, "utf-8");
  // Verify write
  const verifyContent = await readFile(filePath, "utf-8");
  if (verifyContent !== modifiedContent) {
    console.error(`⚠️ Write verification failed for ${filePath}`);
  }
}

/**
 * Mask BUILD_ID in all files
 */
export async function execMaskBuildId(
  buildId: string,
  targetDir: string,
  buildIdPath: string,
): Promise<void> {
  console.log(`BUILD_ID: ${buildId}`);
  console.log(`Scanning directory: ${targetDir}`);

  // 1. Get all files with glob
  const files = await glob("**/*", {
    cwd: targetDir,
    absolute: true,
    nodir: true,
    dot: true,
    ignore: ["**/.git/**", "**/node_modules/**"],
  });

  console.log(`\nFound ${files.length} files to process`);

  // 2. Process all files in parallel, ignoring errors
  await Promise.all(
    files.map(async (file): Promise<void> => {
      if (file.endsWith(buildIdPath)) {
        return Promise.resolve();
      }
      return maskFileContentByBuildId(file, buildId).catch((error) => {
        console.error(`Error processing ${file}: ${error.message}`);
      });
    }),
  );

  console.log("\n✓ Completed");
}

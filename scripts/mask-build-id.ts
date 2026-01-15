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

import { readFile, writeFile, rename, stat } from "fs/promises";
import { glob } from "glob";
import { relative, join, dirname, basename } from "path";

/**
 * Binary file extensions to exclude from processing
 */
const BINARY_EXTENSIONS = new Set([
  // Images
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".bmp",
  // Fonts
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  // Archives
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  // Media
  ".mp4",
  ".mp3",
  ".avi",
  ".mov",
  // Others
  ".pdf",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

/**
 * Check if file is binary based on extension
 */
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Read BUILD_ID file asynchronously
 * @param buildIdPath - Path to the BUILD_ID file
 * @returns The build ID string
 */
async function readBuildId(buildIdPath: string): Promise<string> {
  const content = await readFile(buildIdPath, "utf-8");
  return content.trim();
}

/**
 * Replace BUILD_ID in file content
 * @param content - File content
 * @param buildId - The build ID to replace
 * @returns Modified content with BUILD_ID replaced
 */
function replaceBuildId(content: string, buildId: string): string {
  // Escape special regex characters in buildId
  const escapedBuildId = buildId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedBuildId, "g");
  return content.replace(regex, "${BUILD_ID}");
}

/**
 * Rename file or directory if BUILD_ID is in the path
 * @param path - Path to rename
 * @param buildId - The build ID to replace
 * @param debug - Enable debug logging
 * @returns New path if renamed, null if not renamed
 */
async function renamePath(
  path: string,
  buildId: string,
  debug: boolean = false,
): Promise<string | null> {
  const fileName = basename(path);

  // Check if BUILD_ID is in the filename
  if (!fileName.includes(buildId)) {
    return null;
  }

  // Create new name with BUILD_ID replaced
  const newFileName = replaceBuildId(fileName, buildId);
  const newPath = join(dirname(path), newFileName);

  try {
    await rename(path, newPath);
    if (debug) {
      console.log(`  [RENAMED] ${path} -> ${newPath}`);
    }
    return newPath;
  } catch (error: any) {
    console.error(`  [ERROR] Renaming ${path}: ${error.message}`);
    return null;
  }
}

/**
 * Process a single file: read, replace, write
 * @param filePath - Path to the file
 * @param buildId - The build ID to replace
 * @param debug - Enable debug logging
 * @returns True if file was modified, false otherwise
 */
async function processFile(
  filePath: string,
  buildId: string,
  debug: boolean = false,
): Promise<boolean> {
  try {
    // Skip binary files
    if (isBinaryFile(filePath)) {
      if (debug) {
        console.log(`  [SKIP] Binary file: ${filePath}`);
      }
      return false;
    }

    // Read file
    const content = await readFile(filePath, "utf-8");

    // Check if BUILD_ID exists in content
    if (!content.includes(buildId)) {
      if (debug) {
        console.log(`  [SKIP] No BUILD_ID found: ${filePath}`);
      }
      return false;
    }

    // Replace BUILD_ID
    const modifiedContent = replaceBuildId(content, buildId);

    // Write back
    await writeFile(filePath, modifiedContent, "utf-8");

    if (debug) {
      console.log(`  [MODIFIED] ${filePath}`);
    }

    return true;
  } catch (error: any) {
    // If file is binary (utf-8 read fails), skip silently
    if (error.code === "EINVAL" || error.message?.includes("invalid")) {
      if (debug) {
        console.log(`  [SKIP] Binary read error: ${filePath}`);
      }
      return false;
    }
    console.error(`  [ERROR] ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Mask BUILD_ID in all files within target directory
 * @param targetDir - Directory to process
 * @param buildIdPath - Path to BUILD_ID file
 * @param debug - Enable debug logging
 */
async function maskBuildId(
  targetDir: string,
  buildIdPath: string,
  debug: boolean = false,
): Promise<void> {
  console.log(`Reading BUILD_ID from: ${buildIdPath}`);
  const buildId = await readBuildId(buildIdPath);

  if (!buildId) {
    throw new Error("BUILD_ID is empty");
  }

  console.log(`BUILD_ID: ${buildId}`);
  console.log(`Scanning directory: ${targetDir}`);

  // Get relative path of BUILD_ID file to exclude it
  const buildIdRelativePath = relative(targetDir, buildIdPath);

  // Step 1: Rename directories (deepest first to avoid path conflicts)
  console.log("\nStep 1: Renaming directories...");
  const allPaths = await glob("**/*", {
    cwd: targetDir,
    absolute: true,
    ignore: ["**/.git/**", "**/node_modules/**"],
  });

  // Separate directories and files, sort directories by depth (deepest first)
  const directories: string[] = [];
  const files: string[] = [];

  for (const path of allPaths) {
    const stats = await stat(path);
    if (stats.isDirectory()) {
      directories.push(path);
    } else {
      // Exclude BUILD_ID file from files list
      const relPath = relative(targetDir, path);
      if (relPath !== buildIdRelativePath) {
        files.push(path);
      }
    }
  }

  // Sort directories by depth (deepest first)
  directories.sort((a, b) => {
    const depthA = a.split("/").length;
    const depthB = b.split("/").length;
    return depthB - depthA; // Descending order
  });

  let renamedDirCount = 0;
  const pathMapping = new Map<string, string>(); // old path -> new path

  for (const dir of directories) {
    const newPath = await renamePath(dir, buildId, debug);
    if (newPath) {
      pathMapping.set(dir, newPath);
      renamedDirCount++;
    }
  }

  console.log(`Renamed ${renamedDirCount} directories`);

  // Step 2: Rename files
  console.log("\nStep 2: Renaming files...");
  let renamedFileCount = 0;

  // Update file paths based on directory renames
  const updatedFiles = files.map((file) => {
    for (const [oldDir, newDir] of pathMapping.entries()) {
      if (file.startsWith(oldDir + "/")) {
        return file.replace(oldDir, newDir);
      }
    }
    return file;
  });

  for (const file of updatedFiles) {
    const newPath = await renamePath(file, buildId, debug);
    if (newPath) {
      pathMapping.set(file, newPath);
      renamedFileCount++;
    }
  }

  console.log(`Renamed ${renamedFileCount} files`);

  // Step 3: Process file contents
  console.log("\nStep 3: Processing file contents...");

  // Update file list with final paths after all renames
  const finalFiles = updatedFiles.map((file) => pathMapping.get(file) || file);

  console.log(`Found ${finalFiles.length} files to process`);

  // Process files in parallel (with concurrency limit)
  const CONCURRENCY = 10;
  let processedCount = 0;
  let modifiedCount = 0;

  for (let i = 0; i < finalFiles.length; i += CONCURRENCY) {
    const batch = finalFiles.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((file) => processFile(file, buildId, debug)));

    processedCount += batch.length;
    modifiedCount += results.filter((r) => r).length;

    // Progress logging
    if (!debug && (processedCount % 100 === 0 || processedCount === files.length)) {
      console.log(
        `Progress: ${processedCount}/${finalFiles.length} files processed, ${modifiedCount} modified`,
      );
    }
  }

  console.log(
    `\n✓ Completed: ${renamedDirCount} dirs renamed, ${renamedFileCount} files renamed, ${modifiedCount} file contents modified`,
  );
}

/**
 * Parse command line arguments
 */
function parseArgs(
  args: string[],
): { targetDir: string; buildIdPath: string; debug: boolean } | null {
  if (args.length < 3) {
    return null;
  }

  const targetDir = args[0];
  let buildIdPath: string | undefined;
  let debug = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--build-id" && i + 1 < args.length) {
      buildIdPath = args[i + 1];
      i++; // Skip next argument
    } else if (args[i] === "--debug") {
      debug = true;
    }
  }

  if (!buildIdPath) {
    return null;
  }

  return { targetDir, buildIdPath, debug };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (!parsed) {
    console.error(`Usage: node scripts/mask-build-id.ts <target-directory> --build-id <path-to-BUILD_ID-file> [--debug]

Options:
  --build-id <path>  Path to BUILD_ID file
  --debug            Enable debug logging (show each file processed)

Examples:
  node scripts/mask-build-id.ts .next --build-id .next/BUILD_ID
  node scripts/mask-build-id.ts .next --build-id .next/BUILD_ID --debug
  node scripts/mask-build-id.ts /path/to/build --build-id /path/to/build/BUILD_ID
`);
    process.exit(1);
  }

  try {
    await maskBuildId(parsed.targetDir, parsed.buildIdPath, parsed.debug);
  } catch (error: any) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
}

export { maskBuildId, replaceBuildId };

// Run if executed directly
// In ES modules, we check if the file is the entry point
if (process.argv[1] && process.argv[1].endsWith("mask-build-id.ts")) {
  main();
}

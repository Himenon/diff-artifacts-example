/**
 * Next.js Static Directory Formatter
 *
 * Renames static BUILD_ID directory to template string and replaces BUILD_ID in build-manifest.json
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * Read BUILD_ID file and return its content
 * @param buildIdPath - Path to the BUILD_ID file
 * @returns The build ID string
 */
function readBuildId(buildIdPath: string): string {
  return readFileSync(buildIdPath, "utf-8").trim();
}

/**
 * Rename static BUILD_ID directory to template string
 * @param staticDir - Path to the static directory (e.g., .next/static)
 * @param buildId - The build ID to replace
 * @returns Success status
 */
function renameStaticBuildIdDir(staticDir: string, buildId: string): boolean {
  const oldDirPath = join(staticDir, buildId);
  const newDirPath = join(staticDir, "${BUILD_ID}");

  if (!existsSync(oldDirPath)) {
    console.log(`Directory not found: ${oldDirPath}`);
    return false;
  }

  // If target already exists, skip
  if (existsSync(newDirPath)) {
    console.log(`Target directory already exists: ${newDirPath}`);
    return true;
  }

  renameSync(oldDirPath, newDirPath);
  console.log(`Renamed: ${oldDirPath} -> ${newDirPath}`);
  return true;
}

/**
 * Replace BUILD_ID in build-manifest.json
 * @param buildManifestPath - Path to build-manifest.json
 * @param buildId - The build ID to replace
 * @returns Success status
 */
function replaceBuildIdInManifest(buildManifestPath: string, buildId: string): boolean {
  if (!existsSync(buildManifestPath)) {
    console.log(`File not found: ${buildManifestPath}`);
    return false;
  }

  const content = readFileSync(buildManifestPath, "utf-8");

  // Escape special regex characters in buildId
  const escapedBuildId = buildId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedBuildId, "g");
  const modifiedContent = content.replace(regex, "${BUILD_ID}");

  writeFileSync(buildManifestPath, modifiedContent, "utf-8");
  console.log(`Updated: ${buildManifestPath}`);
  return true;
}

/**
 * Format static directory and build-manifest.json
 * @param baseDir - Base directory (e.g., .next)
 * @returns Result object with success status
 */
export function formatStaticDir(baseDir: string): {
  success: boolean;
  error?: string;
} {
  try {
    // Read BUILD_ID
    const buildIdPath = join(baseDir, "BUILD_ID");
    if (!existsSync(buildIdPath)) {
      return { success: false, error: `BUILD_ID file not found: ${buildIdPath}` };
    }

    const BUILD_ID = readBuildId(buildIdPath);
    if (!BUILD_ID) {
      return { success: false, error: "BUILD_ID is empty" };
    }

    console.log(`BUILD_ID: ${BUILD_ID}`);

    // Rename static BUILD_ID directory
    const staticDir = join(baseDir, "static");
    if (existsSync(staticDir)) {
      renameStaticBuildIdDir(staticDir, BUILD_ID);
    } else {
      console.log(`Static directory not found: ${staticDir}`);
    }

    // Replace BUILD_ID in manifest files
    const manifestFiles = ["build-manifest.json", "fallback-build-manifest.json"];
    for (const manifestFile of manifestFiles) {
      const manifestPath = join(baseDir, manifestFile);
      if (existsSync(manifestPath)) {
        replaceBuildIdInManifest(manifestPath, BUILD_ID);
      } else {
        console.log(`${manifestFile} not found: ${manifestPath}`);
      }
    }

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    return { success: false, error: errorMsg };
  }
}

// CLI execution
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  const baseDir = process.argv[2] || ".next";
  console.log(`\nFormatting static directory: ${baseDir}\n`);

  const result = formatStaticDir(baseDir);

  if (!result.success) {
    console.error(`\n✗ Error: ${result.error}`);
    process.exit(1);
  }

  console.log("\n✓ Successfully completed\n");
}

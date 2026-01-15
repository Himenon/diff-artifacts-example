/**
 * Next.js HTML File Formatter
 *
 * Replaces BUILD_ID in HTML files with a fixed template string
 */

import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";

/**
 * Read BUILD_ID file and return its content
 * @param buildIdPath - Path to the BUILD_ID file
 * @returns The build ID string
 */
function readBuildId(buildIdPath: string): string {
  return readFileSync(buildIdPath, "utf-8").trim();
}

/**
 * Replace BUILD_ID in HTML content with template string
 * @param content - HTML file content
 * @param buildId - The build ID to replace
 * @returns Modified content with BUILD_ID replaced
 */
function replaceBuildIdInHtml(content: string, buildId: string): string {
  // Escape special regex characters in buildId
  const escapedBuildId = buildId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escapedBuildId, "g");
  return content.replace(regex, "${buildId}");
}

/**
 * Format HTML files by replacing BUILD_ID with template string
 * @param buildIdPath - Path to the BUILD_ID file
 * @param htmlPattern - Glob pattern for HTML files
 * @returns Result object with success status and file count
 */
export function formatHtmlFiles(
  buildIdPath: string,
  htmlPattern: string,
): {
  success: boolean;
  fileCount: number;
  error?: string;
} {
  try {
    // Read BUILD_ID
    const BUILD_ID = readBuildId(buildIdPath);

    if (!BUILD_ID) {
      return { success: false, fileCount: 0, error: "BUILD_ID is empty" };
    }

    // Glob HTML files
    const htmlFiles = glob.sync(htmlPattern);

    if (htmlFiles.length === 0) {
      console.log(`No HTML files found matching pattern: ${htmlPattern}`);
      return { success: true, fileCount: 0 };
    }

    // Process each HTML file
    for (const htmlFile of htmlFiles) {
      const content = readFileSync(htmlFile, "utf-8");
      const modifiedContent = replaceBuildIdInHtml(content, BUILD_ID);
      writeFileSync(htmlFile, modifiedContent, "utf-8");
    }

    console.log(`Formatted ${htmlFiles.length} HTML file(s)`);
    return { success: true, fileCount: htmlFiles.length };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    return { success: false, fileCount: 0, error: errorMsg };
  }
}

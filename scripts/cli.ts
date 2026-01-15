#!/usr/bin/env node
/**
 * RSC File Formatter CLI
 *
 * Command-line interface for normalizing .rsc files by replacing buildId
 *
 * Usage:
 *   pnpm exec node scripts/cli.ts path/to/file.rsc
 *   pnpm exec node scripts/cli.ts "glob-pattern"
 *   pnpm exec node scripts/cli.ts --json path/to/file.rsc
 *   pnpm exec node scripts/cli.ts --html .next
 */

import dedent from "dedent";
import { globSync } from "glob";
import { join } from "path";
import { formatAndSave } from "./format-rsc.ts";
import { formatHtmlFiles } from "./format-nextjs-html.ts";

function processGlobPattern(pattern: string, options: { generateJson?: boolean } = {}): void {
  // Find all matching files
  const files = globSync(pattern, {
    nodir: true,
    absolute: false,
  });

  if (files.length === 0) {
    console.log("No files found matching the pattern.");
    return;
  }

  console.log(`Processing ${files.length} file(s):`);
  files.forEach((file) => {
    console.log(`  - ${file}`);
  });
  console.log("");

  // Process each file
  let successCount = 0;
  let failCount = 0;
  const failedFiles: string[] = [];

  files.forEach((file) => {
    const result = formatAndSave(file, options);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failedFiles.push(`${file}: ${result.error}`);
    }
  });

  if (failCount > 0) {
    console.error("\nFailed files:");
    failedFiles.forEach((file) => console.error(`  - ${file}`));
    process.exit(1);
  }
}

/**
 * Main CLI execution function
 * @param args - Command line arguments (typically process.argv.slice(2))
 */
export function main(args: string[]): void {
  // Parse arguments
  let generateJson = false;
  let htmlMode = false;
  const patterns: string[] = [];

  for (const arg of args) {
    if (arg === "--json" || arg === "-j") {
      generateJson = true;
    } else if (arg === "--html") {
      htmlMode = true;
    } else {
      patterns.push(arg);
    }
  }

  if (patterns.length === 0) {
    console.error(dedent`
      Usage: node scripts/cli.ts [options] <path-or-glob-pattern>

      Options:
        --json, -j    Generate .rsc.json files with parsed content
        --html        Format HTML files by replacing BUILD_ID

      Examples:
        RSC files:
          node scripts/cli.ts input.rsc
          node scripts/cli.ts --json input.rsc
          node scripts/cli.ts ".next/server/app/*.rsc"
          node scripts/cli.ts --json "artifacts/*.rsc"

        HTML files:
          node scripts/cli.ts --html .next

      Output:
        RSC mode: Replaces buildId in .rsc files with "\${buildId}"
        HTML mode: Replaces BUILD_ID in .html files with "\${buildId}"
    `);
    process.exit(1);
  }

  try {
    // HTML mode
    if (htmlMode) {
      const baseDir = patterns[0];
      const buildIdPath = join(baseDir, "BUILD_ID");
      const htmlPattern = join(baseDir, "**/*.html");

      console.log(`\nProcessing HTML files in: ${baseDir}`);
      console.log(`BUILD_ID file: ${buildIdPath}`);
      console.log(`HTML pattern: ${htmlPattern}\n`);

      const result = formatHtmlFiles(buildIdPath, htmlPattern);

      if (!result.success) {
        console.error(`\n✗ Error: ${result.error}`);
        process.exit(1);
      }

      console.log(`\n✓ Successfully formatted ${result.fileCount} HTML file(s)\n`);
      return;
    }

    // RSC mode (original behavior)
    const pattern = patterns[0];
    const options = { generateJson };

    // Check if pattern contains glob special characters
    const isGlob = /[*?[\]{}]/.test(pattern);

    if (isGlob) {
      // Process multiple files using glob pattern
      processGlobPattern(pattern, options);
    } else {
      // Process single file
      console.log(`\nProcessing single file: ${pattern}`);
      const result = formatAndSave(pattern, options);

      if (!result.success) {
        console.error(`\n✗ Error: ${result.error}`);
        process.exit(1);
      }

      console.log("\n✓ Successfully completed\n");
      if (generateJson) {
        console.log(`  Generated: ${pattern}.json\n`);
      }
    }
  } catch (error: any) {
    console.error("\n✗ Unexpected error:");
    console.error(`  ${error.message}`);
    if (error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
// Skip execution during tests
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  main(process.argv.slice(2));
}

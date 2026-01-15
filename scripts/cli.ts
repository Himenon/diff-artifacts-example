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
 */

import dedent from "dedent";
import { globSync } from "glob";
import { formatAndSave } from "./format-rsc.ts";

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
  const patterns: string[] = [];

  for (const arg of args) {
    if (arg === "--json" || arg === "-j") {
      generateJson = true;
    } else {
      patterns.push(arg);
    }
  }

  if (patterns.length === 0) {
    console.error(dedent`
      Usage: tsx scripts/cli.ts [options] <path-or-glob-pattern>

      Options:
        --json, -j    Generate .rsc.json files with parsed content

      Examples:
        Single file:
          tsx scripts/cli.ts input.rsc
          tsx scripts/cli.ts --json input.rsc

        Multiple files (glob):
          tsx scripts/cli.ts ".next/server/app/*.rsc"
          tsx scripts/cli.ts --json "artifacts/*.rsc"

      Output:
        Replaces buildId in the original .rsc files with a fixed string "\${buildId}"
        If --json is specified, also creates .rsc.json files with parsed content
    `);
    process.exit(1);
  }

  const pattern = patterns[0];
  const options = { generateJson };

  try {
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

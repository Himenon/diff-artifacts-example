/**
 * RSC File Formatter
 *
 * Converts .rsc files to human-readable .rsc.json format
 *
 * Usage:
 *   tsx scripts/format-rsc.ts path/to/file.rsc
 *   tsx scripts/format-rsc.ts "glob-pattern"
 *   tsx scripts/format-rsc.ts ".next/server/app/page.rsc"
 */

import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';
import { createFlightResponse, processStringChunk } from '@rsc-parser/react-client';
import dedent from 'dedent';

interface ChunkData {
  index: number;
  type: string;
  id: string | number;
  timestamp: number;
  value?: any;
  code?: string;
  error?: {
    message: string;
    digest?: string;
    stack?: string;
  };
  originalValue?: any;
}

function parseRscFile(filePath: string): ChunkData[] {
  // Read file content
  const content = readFileSync(filePath, 'utf-8');

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process the content as string chunks
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  // Process each line as a chunk
  for (const line of lines) {
    processStringChunk(flightResponse, line + '\n');
  }

  // Convert chunks to serializable format
  const chunks: ChunkData[] = [];

  flightResponse._chunks.forEach((chunk: any, index: number) => {
    const chunkData: ChunkData = {
      index: index + 1,
      type: chunk.type,
      id: chunk.id,
      timestamp: chunk.timestamp,
    };

    if (chunk.type === 'module') {
      chunkData.value = {
        id: chunk.value.id,
        name: chunk.value.name,
        chunks: chunk.value.chunks,
      };
    } else if (chunk.type === 'model') {
      chunkData.value = chunk.value;
    } else if (chunk.type === 'text') {
      chunkData.value = chunk.value;
    } else if (chunk.type === 'hint') {
      chunkData.code = chunk.code;
      chunkData.value = chunk.value;
    } else if (chunk.type === 'errorDev' || chunk.type === 'errorProd') {
      chunkData.error = {
        message: chunk.error.message,
        digest: chunk.error.digest,
        stack: chunk.error.stack,
      };
    } else {
      chunkData.originalValue = chunk.originalValue;
    }

    chunks.push(chunkData);
  });

  return chunks;
}


function formatAndSave(inputPath: string): { success: boolean; error?: string } {
  const outputPath = `${inputPath}.json`;

  try {
    // Parse the RSC file
    const chunks = parseRscFile(inputPath);

    // Create output JSON
    const output = {
      metadata: {
        inputFile: inputPath,
        outputFile: outputPath,
        timestamp: new Date().toISOString(),
        chunkCount: chunks.length,
      },
      chunks,
    };

    // Write to JSON file
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    return { success: false, error: errorMsg };
  }
}

function processGlobPattern(pattern: string): void {
  // Find all matching files
  const files = globSync(pattern, {
    nodir: true,
    absolute: false,
  });

  if (files.length === 0) {
    console.log('No files found matching the pattern.');
    return;
  }

  console.log(`Processing ${files.length} file(s)...`);

  // Process each file
  let successCount = 0;
  let failCount = 0;
  const failedFiles: string[] = [];

  files.forEach((file) => {
    const result = formatAndSave(file);

    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failedFiles.push(`${file}: ${result.error}`);
    }
  });

  // Summary
  console.log(dedent`

    ${'='.repeat(50)}
    Summary:
      Total:   ${files.length}
      Success: ${successCount}
      Failed:  ${failCount}
    ${'='.repeat(50)}
  `);

  if (failCount > 0) {
    console.error('\nFailed files:');
    failedFiles.forEach(file => console.error(`  - ${file}`));
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error(dedent`
    Usage: tsx scripts/format-rsc.ts <path-or-glob-pattern>

    Examples:
      Single file:
        tsx scripts/format-rsc.ts input.rsc

      Multiple files (glob):
        tsx scripts/format-rsc.ts ".next/server/app/page.rsc"
        tsx scripts/format-rsc.ts "artifacts/*.rsc"

    Output:
      Creates .rsc.json files next to each input file
      (e.g., input.rsc → input.rsc.json)
  `);
  process.exit(1);
}

const pattern = args[0];

try {
  // Check if pattern contains glob special characters
  const isGlob = /[*?[\]{}]/.test(pattern);

  if (isGlob) {
    // Process multiple files using glob pattern
    processGlobPattern(pattern);
  } else {
    // Process single file
    console.log(`\nProcessing single file: ${pattern}`);
    const result = formatAndSave(pattern);

    if (!result.success) {
      console.error(`\n✗ Error: ${result.error}`);
      process.exit(1);
    }

    console.log('\n✓ Successfully completed\n');
  }
} catch (error: any) {
  console.error('\n✗ Unexpected error:');
  console.error(`  ${error.message}`);
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}
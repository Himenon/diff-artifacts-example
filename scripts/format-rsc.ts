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
import { createFlightResponse, processStringChunk, processBinaryChunk } from '@rsc-parser/react-client';

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
  console.log(`\nParsing RSC file: ${filePath}`);

  // Read file content
  const content = readFileSync(filePath, 'utf-8');

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process the content as string chunks
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  console.log(`Found ${lines.length} chunks`);

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

function parseRscFileBinary(filePath: string): ChunkData[] {
  console.log(`\nParsing RSC file (binary mode): ${filePath}`);

  // Read file as binary
  const buffer = readFileSync(filePath);

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process as binary chunk
  processBinaryChunk(flightResponse, buffer);

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

function formatAndSave(inputPath: string, useBinary: boolean = false, quiet: boolean = false): { success: boolean; error?: string } {
  const outputPath = `${inputPath}.json`;

  if (!quiet) {
    console.log(`\nProcessing: ${inputPath}`);
  }

  try {
    // Parse the RSC file
    const chunks = useBinary ? parseRscFileBinary(inputPath) : parseRscFile(inputPath);

    // Create output JSON
    const output = {
      metadata: {
        inputFile: inputPath,
        outputFile: outputPath,
        timestamp: new Date().toISOString(),
        chunkCount: chunks.length,
        mode: useBinary ? 'binary' : 'text',
      },
      chunks,
    };

    // Write to JSON file
    writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

    if (!quiet) {
      console.log(`  ✓ ${chunks.length} chunks → ${outputPath}`);
    }

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    if (!quiet) {
      console.error(`  ✗ Failed: ${errorMsg}`);
    }
    return { success: false, error: errorMsg };
  }
}

function processGlobPattern(pattern: string, useBinary: boolean = false): void {
  console.log(`\nSearching for files matching: ${pattern}`);

  // Find all matching files
  const files = globSync(pattern, {
    nodir: true,
    absolute: false,
  });

  if (files.length === 0) {
    console.log('No files found matching the pattern.');
    return;
  }

  console.log(`Found ${files.length} file(s)\n`);

  // Process each file
  let successCount = 0;
  let failCount = 0;

  files.forEach((file, index) => {
    console.log(`[${index + 1}/${files.length}] ${file}`);
    const result = formatAndSave(file, useBinary, true);

    if (result.success) {
      successCount++;
      console.log(`  ✓ Success`);
    } else {
      failCount++;
      console.log(`  ✗ Failed: ${result.error}`);
    }
  });

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Summary:`);
  console.log(`  Total:   ${files.length}`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Failed:  ${failCount}`);
  console.log(`${'='.repeat(50)}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: tsx scripts/format-rsc.ts <path-or-glob-pattern> [--binary]');
  console.error('\nExamples:');
  console.error('  Single file:');
  console.error('    tsx scripts/format-rsc.ts input.rsc');
  console.error('    tsx scripts/format-rsc.ts input.rsc --binary');
  console.error('');
  console.error('  Multiple files (glob):');
  console.error('    tsx scripts/format-rsc.ts "**/*.rsc"');
  console.error('    tsx scripts/format-rsc.ts ".next/**/*.rsc"');
  console.error('    tsx scripts/format-rsc.ts ".next/server/app/**/*.rsc"');
  console.error('');
  console.error('Output:');
  console.error('  Creates .rsc.json files next to each input file');
  console.error('  (e.g., input.rsc → input.rsc.json)');
  process.exit(1);
}

const pattern = args[0];
const useBinary = args.includes('--binary');

try {
  // Check if pattern contains glob special characters
  const isGlob = /[*?[\]{}]/.test(pattern);

  if (isGlob) {
    // Process multiple files using glob pattern
    processGlobPattern(pattern, useBinary);
  } else {
    // Process single file
    console.log(`\nProcessing single file: ${pattern}`);
    const result = formatAndSave(pattern, useBinary);

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
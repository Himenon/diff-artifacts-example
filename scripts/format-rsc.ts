/**
 * RSC File Formatter
 *
 * Converts .rsc files to human-readable .rsc.json format
 *
 * Usage:
 *   tsx scripts/format-rsc.ts path/to/file.rsc
 */

import { readFileSync, writeFileSync } from 'fs';
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

function formatAndSave(inputPath: string, useBinary: boolean = false): void {
  const outputPath = `${inputPath}.json`;

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);

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

  console.log(`\n✓ Successfully formatted ${chunks.length} chunks`);
  console.log(`✓ Saved to: ${outputPath}\n`);
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: tsx scripts/format-rsc.ts <path-to-rsc-file> [--binary]');
  console.error('\nExample:');
  console.error('  tsx scripts/format-rsc.ts input.rsc');
  console.error('  tsx scripts/format-rsc.ts input.rsc --binary');
  console.error('\nOutput:');
  console.error('  Creates input.rsc.json next to the input file');
  process.exit(1);
}

const filePath = args[0];
const useBinary = args.includes('--binary');

try {
  formatAndSave(filePath, useBinary);
} catch (error: any) {
  console.error('\n✗ Error formatting RSC file:');
  console.error(`  ${error.message}`);
  if (error.stack) {
    console.error('\nStack trace:');
    console.error(error.stack);
  }
  process.exit(1);
}
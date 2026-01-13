/**
 * Simple RSC Parser Example
 *
 * Usage:
 *   node examples/simple-parser.js path/to/file.rsc
 */

import { readFileSync } from 'fs';
import { createFlightResponse, processStringChunk, processBinaryChunk } from '@rsc-parser/react-client';

function parseRscFile(filePath) {
  console.log(`\nParsing RSC file: ${filePath}\n`);

  // Read file content
  const content = readFileSync(filePath, 'utf-8');

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process the content as string chunks
  // Note: You can split by newlines if the file contains multiple chunks
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  console.log(`Found ${lines.length} chunks\n`);

  // Process each line as a chunk
  for (const line of lines) {
    processStringChunk(flightResponse, line + '\n');
  }

  // Display parsed results
  console.log('=== Parsed Chunks ===\n');

  flightResponse._chunks.forEach((chunk, index) => {
    console.log(`Chunk #${index + 1}:`);
    console.log(`  Type: ${chunk.type}`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Timestamp: ${chunk.timestamp}`);

    if (chunk.type === 'module') {
      console.log(`  Module ID: ${chunk.value.id}`);
      console.log(`  Module Name: ${chunk.value.name}`);
      console.log(`  Module Chunks: ${JSON.stringify(chunk.value.chunks)}`);
    } else if (chunk.type === 'model') {
      console.log(`  Value: ${JSON.stringify(chunk.value, null, 2)}`);
    } else if (chunk.type === 'text') {
      console.log(`  Text: ${chunk.value.substring(0, 100)}${chunk.value.length > 100 ? '...' : ''}`);
    } else if (chunk.type === 'hint') {
      console.log(`  Hint Code: ${chunk.code}`);
      console.log(`  Hint Model: ${JSON.stringify(chunk.value)}`);
    } else if (chunk.type === 'errorDev' || chunk.type === 'errorProd') {
      console.log(`  Error: ${chunk.error.message}`);
      console.log(`  Digest: ${chunk.error.digest}`);
    } else {
      console.log(`  Original Value: ${JSON.stringify(chunk.originalValue)}`);
    }

    console.log('');
  });

  return flightResponse;
}

function parseRscFileBinary(filePath) {
  console.log(`\nParsing RSC file (binary mode): ${filePath}\n`);

  // Read file as binary
  const buffer = readFileSync(filePath);

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process as binary chunk
  processBinaryChunk(flightResponse, buffer);

  // Display parsed results
  console.log('=== Parsed Chunks ===\n');

  flightResponse._chunks.forEach((chunk, index) => {
    console.log(`Chunk #${index + 1}:`);
    console.log(`  Type: ${chunk.type}`);
    console.log(`  ID: ${chunk.id}`);
    console.log(`  Timestamp: ${chunk.timestamp}`);

    if (chunk.type === 'module') {
      console.log(`  Module ID: ${chunk.value.id}`);
      console.log(`  Module Name: ${chunk.value.name}`);
      console.log(`  Module Chunks: ${JSON.stringify(chunk.value.chunks)}`);
    } else if (chunk.type === 'model') {
      console.log(`  Value: ${JSON.stringify(chunk.value, null, 2)}`);
    } else if (chunk.type === 'text') {
      console.log(`  Text: ${chunk.value.substring(0, 100)}${chunk.value.length > 100 ? '...' : ''}`);
    } else {
      console.log(`  Original Value: ${JSON.stringify(chunk.originalValue)}`);
    }

    console.log('');
  });

  return flightResponse;
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node examples/simple-parser.js <path-to-rsc-file> [--binary]');
  console.error('\nExample:');
  console.error('  node examples/simple-parser.js sample.rsc');
  console.error('  node examples/simple-parser.js sample.rsc --binary');
  process.exit(1);
}

const filePath = args[0];
const useBinary = args.includes('--binary');

try {
  if (useBinary) {
    parseRscFileBinary(filePath);
  } else {
    parseRscFile(filePath);
  }

  console.log('✓ Parsing completed successfully\n');
} catch (error) {
  console.error('✗ Error parsing RSC file:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}
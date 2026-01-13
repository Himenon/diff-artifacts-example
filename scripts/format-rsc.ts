/**
 * RSC File Formatter
 *
 * Converts .rsc files to human-readable .rsc.json format
 *
 * Usage:
 *   pnpm exec node scripts/format-rsc.ts path/to/file.rsc
 *   pnpm exec node scripts/format-rsc.ts "glob-pattern"
 */

import { type Chunk, createFlightResponse, processStringChunk } from "@rsc-parser/react-client";
import dedent from "dedent";
import { readFileSync, writeFileSync } from "fs";
import { globSync } from "glob";

/**
 * RSCチャンクのフォーマット済みデータ
 */
interface ChunkData {
  /** フォーマッター側で付与した連番（1から開始） */
  index: number;
  /** RSCチャンクのタイプ（例: 'module', 'model', 'text', 'hint', 'errorDev', 'errorProd'） */
  type: string;
  /** RSCチャンクのID（チャンク参照用） */
  id: string;
  /** RSCチャンクが作成された時刻（ミリ秒単位のタイムスタンプ） */
  timestamp: number;
  /** チャンクの値（パース済み）- typeに応じて内容が異なる */
  value?: any;
  /** ヒントチャンクのコード（type='hint'の場合のみ） */
  code?: string;
  /** エラーチャンクのエラー情報（type='errorDev'または'errorProd'の場合のみ） */
  error?: {
    /** エラーメッセージ */
    message: string;
    /** エラーダイジェスト（任意） */
    digest?: string;
    /** スタックトレース（任意） */
    stack?: string;
  };
}

/**
 * フォーマット済みのRSCファイル出力データ
 */
interface OutputData {
  /** メタデータ */
  metadata: {
    /** 入力ファイルパス */
    inputFile: string;
    /** 出力ファイルパス */
    outputFile: string;
    /** チャンクの総数 */
    chunkCount: number;
  };
  /** パース・フォーマットされたチャンクの配列 */
  chunks: ChunkData[];
}

function isChunk(chunk: unknown): chunk is Chunk {
  return (
    typeof chunk === "object" &&
    chunk !== null &&
    "type" in chunk &&
    typeof (chunk as Chunk).type === "string" &&
    "id" in chunk &&
    "timestamp" in chunk &&
    typeof (chunk as Chunk).timestamp === "number"
  );
}

function parseRscFile(filePath: string): ChunkData[] {
  // Read file content
  const content = readFileSync(filePath, "utf-8");

  // Create Flight Response (true = development mode)
  const flightResponse = createFlightResponse(true);

  // Process the content as string chunks
  const lines = content.split("\n").filter((line) => line.trim().length > 0);

  // Process each line as a chunk
  for (const line of lines) {
    processStringChunk(flightResponse, line + "\n");
  }

  // Convert chunks to serializable format
  const chunks: ChunkData[] = [];

  flightResponse._chunks.forEach((chunk: unknown, index: number) => {
    if (!isChunk(chunk)) {
      console.warn(`Skipping invalid chunk at index ${index}`);
      return;
    }

    const chunkData: ChunkData = {
      index: index + 1,
      type: chunk.type,
      id: chunk.id,
      timestamp: chunk.timestamp,
    };

    switch (chunk.type) {
      case "module":
        chunkData.value = chunk.value;
        break;

      case "model":
        chunkData.value = chunk.value;
        break;

      case "text":
        chunkData.value = chunk.value;
        break;

      case "hint":
        chunkData.code = chunk.code;
        chunkData.value = chunk.value;
        break;

      case "errorDev":
      case "errorProd":
        chunkData.error = {
          message: chunk.error.message,
          digest: chunk.error.digest,
          stack: chunk.error.stack,
        };
        break;

      case "postponeDev":
      case "postponeProd":
        chunkData.error = {
          message: chunk.error.message,
          digest: undefined,
          stack: undefined,
        };
        break;

      case "buffer":
      case "debugInfo":
      case "console":
      case "startReadableStream":
      case "startAsyncIterable":
      case "stopStream":
        chunkData.value = chunk.value;
        break;
      default:
        // For any unknown types, just keep the basic chunk data
        throw new Error(`Unknown chunk type: ${chunk satisfies never}`);
    }

    chunks.push(chunkData);
  });

  return chunks;
}

function formatAndSave(inputPath: string): {
  success: boolean;
  error?: string;
} {
  const outputPath = `${inputPath}.json`;

  try {
    // Parse the RSC file
    const chunks = parseRscFile(inputPath);

    // Create output JSON
    const output: OutputData = {
      metadata: {
        inputFile: inputPath,
        outputFile: outputPath,
        chunkCount: chunks.length,
      },
      chunks,
    };

    // Write to JSON file
    writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
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
    const result = formatAndSave(file);

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

    console.log("\n✓ Successfully completed\n");
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

/**
 * RSC File Formatter - Core Logic
 *
 * Normalizes .rsc files by replacing buildId with a fixed string using AST manipulation
 */

import { type Chunk, createFlightResponse, processStringChunk } from "@rsc-parser/react-client";
import { readFileSync, writeFileSync } from "fs";

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

/**
 * Parses RSC file content and returns the FlightResponse object with line mapping
 * @param content - The RSC file content
 * @returns Object with FlightResponse and line mapping
 */
function parseRscContent(content: string): {
  flightResponse: any;
  lines: string[];
  lineMap: Map<string, number>;
} {
  const flightResponse = createFlightResponse(true);
  const lines = content.split("\n");
  const lineMap = new Map<string, number>();

  lines.forEach((line, index) => {
    if (line.trim().length > 0) {
      // Extract chunk ID from the line (format: "ID:...")
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const id = line.substring(0, colonIndex);
        lineMap.set(id, index);
      }
      processStringChunk(flightResponse, line + "\n");
    }
  });

  return { flightResponse, lines, lineMap };
}

/**
 * Parses RSC file and returns chunks with buildId replaced
 * @param filePath - Path to the RSC file
 * @returns Array of ChunkData with buildId masked
 */
function parseRscFile(filePath: string): ChunkData[] {
  const content = readFileSync(filePath, "utf-8");
  const { flightResponse } = parseRscContent(content);

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
        if (chunk.value && typeof chunk.value === "object" && "buildId" in chunk.value) {
          chunkData.value = {
            ...chunk.value,
            buildId: "${buildId}",
          };
        } else {
          chunkData.value = chunk.value;
        }
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
        throw new Error(`Unknown chunk type: ${chunk satisfies never}`);
    }

    chunks.push(chunkData);
  });

  return chunks;
}

/**
 * Serializes a chunk back to RSC format line
 * @param chunk - The chunk to serialize
 * @returns RSC format line
 */
function serializeChunk(chunk: Chunk): string {
  const id = chunk.id;
  let value: any;

  switch (chunk.type) {
    case "model":
      value = chunk.value;
      break;
    case "module":
      value = chunk.value;
      break;
    case "text":
      value = chunk.value;
      break;
    case "hint":
      value = chunk.value;
      break;
    case "errorDev":
    case "errorProd":
      value = chunk.error;
      break;
    case "postponeDev":
    case "postponeProd":
      value = chunk.error;
      break;
    default:
      value = (chunk as any).value;
  }

  return `${id}:${JSON.stringify(value)}`;
}

/**
 * Replaces buildId in RSC content with a fixed template string using AST manipulation
 * @param content - The RSC file content
 * @returns The content with buildId replaced
 */
export function replaceBuildId(content: string): string {
  // Parse RSC content into FlightResponse with line mapping
  const { flightResponse, lines, lineMap } = parseRscContent(content);

  // Process each chunk and replace buildId in the original lines
  flightResponse._chunks.forEach((chunk: unknown) => {
    if (!isChunk(chunk)) {
      return;
    }

    // Replace buildId in model chunks
    if (chunk.type === "model" && chunk.value && typeof chunk.value === "object") {
      const hasBuildId = "buildId" in chunk.value || "b" in chunk.value;
      if (hasBuildId) {
        // Find the original line for this chunk
        const lineIndex = lineMap.get(chunk.id);
        if (lineIndex !== undefined) {
          const originalLine = lines[lineIndex];
          const colonIndex = originalLine.indexOf(":");
          if (colonIndex !== -1) {
            const prefix = originalLine.substring(0, colonIndex + 1);
            const jsonPart = originalLine.substring(colonIndex + 1);

            try {
              const parsed = JSON.parse(jsonPart);
              // Update buildId fields
              if ("buildId" in parsed) {
                parsed.buildId = "${buildId}";
              }
              if ("b" in parsed) {
                parsed.b = "${buildId}";
              }
              // Reconstruct the line
              lines[lineIndex] = prefix + JSON.stringify(parsed);
            } catch (error) {
              // If parsing fails, use regex replacement as fallback
              let newLine = originalLine;
              newLine = newLine.replace(/"buildId":"[^"]*"/, '"buildId":"${buildId}"');
              newLine = newLine.replace(/"b":"[^"]*"/, '"b":"${buildId}"');
              lines[lineIndex] = newLine;
            }
          }
        }
      }
    }
  });

  return lines.join("\n");
}

/**
 * Formats and saves an RSC file by replacing buildId
 * @param inputPath - Path to the input RSC file
 * @param options - Options for formatting
 * @returns Result object with success status and optional error message
 */
export function formatAndSave(
  inputPath: string,
  options: { generateJson?: boolean } = {},
): {
  success: boolean;
  error?: string;
} {
  try {
    // Read the original RSC file
    const content = readFileSync(inputPath, "utf-8");

    // Replace buildId in content
    const processedContent = replaceBuildId(content);

    // Write back to the original file
    writeFileSync(inputPath, processedContent, "utf-8");

    // Generate JSON file if requested
    if (options.generateJson) {
      const outputPath = `${inputPath}.json`;
      const chunks = parseRscFile(inputPath);

      const workDir = process.cwd();
      const formatPath = (path: string) => {
        if (path.startsWith(workDir)) {
          return path.replace(workDir, "${workDir}");
        }
        return path;
      };

      const output: OutputData = {
        metadata: {
          inputFile: formatPath(inputPath),
          outputFile: formatPath(outputPath),
          chunkCount: chunks.length,
        },
        chunks,
      };

      writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf-8");
    }

    return { success: true };
  } catch (error: any) {
    const errorMsg = error.message || "Unknown error";
    return { success: false, error: errorMsg };
  }
}

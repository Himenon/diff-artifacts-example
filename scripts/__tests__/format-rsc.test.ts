import { readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { replaceBuildId, formatAndSave } from "../format-rsc";

const TEST_DIR = join(__dirname, "__test-rsc-files__");
const TEST_INPUT_FILE = join(TEST_DIR, "input.rsc");

describe("format-rsc.ts", () => {
  describe("replaceBuildId", () => {
    it("should replace buildId in RSC content", () => {
      const input = `1:"$Sreact.fragment"
2:I[99041,["/_next/static/chunks/d5e289bff96cf0c1.js"],"default"]
0:{"P":null,"b":"abc123BuildId456","c":["",""],"q":"","i":false}
3:I[27296,["/_next/static/chunks/90b6cc51d8400a71.js"],"Image"]`;

      const result = replaceBuildId(input);

      // Check that buildId has been masked
      expect(result).toContain('"b":"${buildId}"');
      expect(result).not.toContain('"b":"abc123BuildId456"');

      // Check that other content remains unchanged
      expect(result).toContain('1:"$Sreact.fragment"');
      expect(result).toContain("2:I[99041");
      expect(result).toContain("3:I[27296");
    });

    it("should handle multiple buildIds", () => {
      const input = `0:{"P":null,"b":"firstBuildId123","c":[]}
1:{"P":null,"b":"secondBuildId456","c":[]}
2:{"P":null,"b":"thirdBuildId789","c":[]}`;

      const result = replaceBuildId(input);

      // All buildIds should be masked
      const buildIdMatches = result.match(/"b":"\$\{buildId\}"/g);
      expect(buildIdMatches).toHaveLength(3);

      // Original buildIds should not exist
      expect(result).not.toContain("firstBuildId123");
      expect(result).not.toContain("secondBuildId456");
      expect(result).not.toContain("thirdBuildId789");
    });

    it("should handle content without buildId", () => {
      const input = `1:"$Sreact.fragment"
2:I[99041,["/_next/static/chunks/d5e289bff96cf0c1.js"],"default"]
0:{"P":null,"c":["",""],"q":"","i":false}`;

      const result = replaceBuildId(input);

      // Content should remain the same
      expect(result).toBe(input);
    });

    it("should preserve line structure", () => {
      const input = `1:"$Sreact.fragment"
2:I[99041,["/_next/static/chunks/d5e289bff96cf0c1.js"],"default"]
0:{"P":null,"b":"abc123BuildId456","c":["",""],"q":"","i":false}
3:I[27296,["/_next/static/chunks/90b6cc51d8400a71.js"],"Image"]`;

      const result = replaceBuildId(input);
      const inputLines = input.split("\n");
      const resultLines = result.split("\n");

      // Line count should remain the same
      expect(resultLines.length).toBe(inputLines.length);

      // Line structure (before colon) should remain the same
      inputLines.forEach((line, index) => {
        if (line.includes(":")) {
          const inputPrefix = line.split(":")[0];
          const resultPrefix = resultLines[index].split(":")[0];
          expect(resultPrefix).toBe(inputPrefix);
        }
      });
    });
  });

  describe("formatAndSave", () => {
    beforeEach(() => {
      // Create test directory
      mkdirSync(TEST_DIR, { recursive: true });

      // Create a sample .rsc file with buildId
      const sampleContent = `1:"$Sreact.fragment"
2:I[99041,["/_next/static/chunks/d5e289bff96cf0c1.js"],"default"]
0:{"P":null,"b":"abc123BuildId456","c":["",""],"q":"","i":false}
3:I[27296,["/_next/static/chunks/90b6cc51d8400a71.js"],"Image"]`;

      writeFileSync(TEST_INPUT_FILE, sampleContent, "utf-8");
    });

    afterEach(() => {
      // Clean up test directory
      rmSync(TEST_DIR, { recursive: true, force: true });
    });

    it("should mask buildId in .rsc file", () => {
      const result = formatAndSave(TEST_INPUT_FILE);

      // Check that operation succeeded
      expect(result.success).toBe(true);

      // Read the modified file
      const modifiedContent = readFileSync(TEST_INPUT_FILE, "utf-8");

      // Check that buildId has been masked
      expect(modifiedContent).toContain('"b":"${buildId}"');
      expect(modifiedContent).not.toContain('"b":"abc123BuildId456"');

      // Check that other content remains unchanged
      expect(modifiedContent).toContain('1:"$Sreact.fragment"');
      expect(modifiedContent).toContain("2:I[99041");
      expect(modifiedContent).toContain("3:I[27296");
    });

    it("should preserve file structure", () => {
      const originalLines = readFileSync(TEST_INPUT_FILE, "utf-8").split("\n");
      const originalLineCount = originalLines.length;

      // Run the format-rsc function
      const result = formatAndSave(TEST_INPUT_FILE);
      expect(result.success).toBe(true);

      const modifiedLines = readFileSync(TEST_INPUT_FILE, "utf-8").split("\n");
      const modifiedLineCount = modifiedLines.length;

      // Line count should remain the same
      expect(modifiedLineCount).toBe(originalLineCount);

      // Line structure (before colon) should remain the same
      originalLines.forEach((line, index) => {
        if (line.includes(":")) {
          const originalPrefix = line.split(":")[0];
          const modifiedPrefix = modifiedLines[index].split(":")[0];
          expect(modifiedPrefix).toBe(originalPrefix);
        }
      });
    });

    it("should handle multiple buildIds in different lines", () => {
      // Create a file with multiple buildIds
      const multipleBuildsContent = `0:{"P":null,"b":"firstBuildId123","c":[]}
1:{"P":null,"b":"secondBuildId456","c":[]}
2:{"P":null,"b":"thirdBuildId789","c":[]}`;

      writeFileSync(TEST_INPUT_FILE, multipleBuildsContent, "utf-8");

      // Run the script
      const result = formatAndSave(TEST_INPUT_FILE);
      expect(result.success).toBe(true);

      // Read the modified file
      const modifiedContent = readFileSync(TEST_INPUT_FILE, "utf-8");

      // All buildIds should be masked
      const buildIdMatches = modifiedContent.match(/"b":"\$\{buildId\}"/g);
      expect(buildIdMatches).toHaveLength(3);

      // Original buildIds should not exist
      expect(modifiedContent).not.toContain("firstBuildId123");
      expect(modifiedContent).not.toContain("secondBuildId456");
      expect(modifiedContent).not.toContain("thirdBuildId789");
    });

    it("should handle files without buildId", () => {
      // Create a file without buildId
      const noBuildIdContent = `1:"$Sreact.fragment"
2:I[99041,["/_next/static/chunks/d5e289bff96cf0c1.js"],"default"]
0:{"P":null,"c":["",""],"q":"","i":false}`;

      writeFileSync(TEST_INPUT_FILE, noBuildIdContent, "utf-8");

      // Run the script
      const result = formatAndSave(TEST_INPUT_FILE);
      expect(result.success).toBe(true);

      // Read the modified file
      const modifiedContent = readFileSync(TEST_INPUT_FILE, "utf-8");

      // Content should remain the same
      expect(modifiedContent).toBe(noBuildIdContent);
    });
  });
});

import { expect, describe, it } from "vitest";
import * as Module from "../core.ts";

describe("core.ts", () => {
  it("html replace test", () => {
    const input = `<!DOCTYPE html><!--_0SevPWu_9tWXgZEtdt_v--><html lang="en"><head>`;
    const expected = '<!DOCTYPE html><!--${BUILD_ID}--><html lang="en"><head>';
    const output = Module.replaceBuildId(input, "_0SevPWu_9tWXgZEtdt_v");
    expect(expected).toBe(output);
  });
});

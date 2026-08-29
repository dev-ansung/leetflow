
import { describe, it, expect } from "bun:test";
import { TypeScriptRunner } from "../../src/runners/typescript-runner";
import { PythonRunner } from "../../src/runners/python-runner";
import { RunnerFactory } from "../../src/runners/runner-factory";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("Multi-Language Runner Sandbox Suite", () => {
  it("should resolve correct runner from file extension via RunnerFactory", () => {
    expect(RunnerFactory.getRunner("solution.py").language).toBe("python");
    expect(RunnerFactory.getRunner("solution.ts").language).toBe("typescript");
    expect(RunnerFactory.getRunner("solution.cpp").language).toBe("cpp");
    expect(() => RunnerFactory.getRunner("solution.unknown")).toThrow();
  });

  it("should execute valid TypeScript solution and pass all cases", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-ts-test-"));
    const solPath = path.join(tmpDir, "solution.ts");

    fs.writeFileSync(solPath, `
export class Solution {
  twoSum(nums: number[], target: number): number[] {
    const map = new Map<number, number>();
    for (let i = 0; i < nums.length; i++) {
      const complement = target - nums[i];
      if (map.has(complement)) {
        return [map.get(complement)!, i];
      }
      map.set(nums[i], i);
    }
    return [];
  }
}
`, "utf-8");

    const cases = [
      { id: 1, input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { id: 2, input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      { id: 3, input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
    ];

    const res = await TypeScriptRunner.runTests(solPath, "twoSum", cases);
    expect(res.allPassed).toBe(true);
    expect(res.passedCount).toBe(3);
    expect(res.totalCount).toBe(3);
    expect(res.totalDurationMs).toBeGreaterThan(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should catch failing TypeScript test cases and report diff", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-ts-fail-"));
    const solPath = path.join(tmpDir, "solution.ts");

    fs.writeFileSync(solPath, `
export class Solution {
  twoSum(nums: number[], target: number): number[] {
    return [0, 0];
  }
}
`, "utf-8");

    const cases = [
      { id: 1, input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
    ];

    const res = await TypeScriptRunner.runTests(solPath, "twoSum", cases);
    expect(res.allPassed).toBe(false);
    expect(res.passedCount).toBe(0);
    expect(res.caseResults[0].actual).toEqual([0, 0]);
    expect(res.caseResults[0].passed).toBe(false);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should handle TypeScript execution timeouts (infinite loops)", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-ts-timeout-"));
    const solPath = path.join(tmpDir, "solution.ts");

    fs.writeFileSync(solPath, `
export class Solution {
  twoSum(nums: number[], target: number): number[] {
    while (true) {}
  }
}
`, "utf-8");

    const cases = [
      { id: 1, input: { nums: [1, 2], target: 3 }, expected: [0, 1] },
    ];

    const res = await TypeScriptRunner.runTests(solPath, "twoSum", cases, 1500);
    expect(res.allPassed).toBe(false);
    expect(res.error).toContain("timed out");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  }, 5000);
});

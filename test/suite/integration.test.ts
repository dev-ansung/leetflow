import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MetricsEngine } from "../../src/core/metrics";
import { LeetCodeProvider } from "../../src/providers/leetcode";
import { PythonRunner } from "../../src/runners/python-runner";

describe("LeetFlow Integration & PoC Test Suite", () => {
  it("1. Sourcing: should fetch LC 1 (Two Sum) from LeetCode GraphQL", async () => {
    const problem = await LeetCodeProvider.fetchProblem("two-sum");
    expect(problem.id).toBe(1);
    expect(problem.title).toBe("Two Sum");
    expect(problem.difficulty).toBe("Easy");
    expect(problem.testCases.length).toBeGreaterThan(0);
    expect(problem.starterCode).toContain("class Solution");
  }, 10000);

  it("2. Sandbox: should execute valid Python code and pass test cases", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-test-"));
    const solPath = path.join(tmpDir, "solution.py");

    // Correct Two Sum implementation
    fs.writeFileSync(
      solPath,
      `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i
        return []
`,
      "utf-8",
    );

    const cases = [
      { id: 1, input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { id: 2, input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] },
      { id: 3, input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
    ];

    const res = await PythonRunner.runTests(solPath, "twoSum", cases);
    expect(res.allPassed).toBe(true);
    expect(res.passedCount).toBe(3);
    expect(res.caseResults.length).toBe(3);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("3. Sandbox: should detect and handle failing test cases", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-test-fail-"));
    const solPath = path.join(tmpDir, "solution.py");

    // Buggy implementation
    fs.writeFileSync(
      solPath,
      `
class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        return [0, 0]
`,
      "utf-8",
    );

    const cases = [{ id: 1, input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] }];

    const res = await PythonRunner.runTests(solPath, "twoSum", cases);
    expect(res.allPassed).toBe(false);
    expect(res.passedCount).toBe(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("4. Metrics: should calculate Elo rating adjustments", () => {
    // Fast solve of Easy problem (target 900s, solved in 300s)
    const { newElo, delta } = MetricsEngine.calculateElo(1400, 1200, 300, 900, true);
    expect(delta).toBeGreaterThan(0);
    expect(newElo).toBeGreaterThan(1400);

    // Failed solve
    const failRes = MetricsEngine.calculateElo(1400, 1200, 900, 900, false);
    expect(failRes.delta).toBeLessThan(0);
    expect(failRes.newElo).toBeLessThan(1400);
  });

  it("5. Metrics: should calculate SM-2 spaced repetition intervals", () => {
    // Smooth solve first repetition
    const res1 = MetricsEngine.calculateSM2(2, 0, 0);
    expect(res1.nextIntervalDays).toBe(1);

    // Second repetition
    const res2 = MetricsEngine.calculateSM2(2, 1, 1);
    expect(res2.nextIntervalDays).toBe(6);

    // Struggled (reset)
    const resFail = MetricsEngine.calculateSM2(4, 5, 30);
    expect(resFail.nextIntervalDays).toBe(1);
    expect(resFail.newRepetition).toBe(0);
  });
});

import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TestCase, TestResult } from "../types";
import type { CodeRunner } from "./runner-interface";

export class TypeScriptRunner implements CodeRunner {
  readonly language = "typescript";
  readonly fileExtension = ".ts";

  static async runTests(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
    timeoutMs: number = 4000,
  ): Promise<TestResult> {
    const runner = new TypeScriptRunner();
    return runner.runTests(solutionPath, functionName, testCases, timeoutMs);
  }

  async runTests(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
    timeoutMs: number = 4000,
  ): Promise<TestResult> {
    const dir = path.dirname(solutionPath);
    const modBase = path.basename(solutionPath, ".ts");
    const harnessPath = path.join(dir, "__harness__.ts");

    const casesJson = JSON.stringify(testCases);

    const harnessContent = [
      `import { Solution } from "./${modBase}";`,
      "",
      "function deepEqual(a: any, b: any): boolean {",
      "  if (a === b) return true;",
      "  if (typeof a !== typeof b) return false;",
      "  if (Array.isArray(a) && Array.isArray(b)) {",
      "    if (a.length !== b.length) return false;",
      "    return a.every((val, idx) => deepEqual(val, b[idx]));",
      "  }",
      "  if (typeof a === 'object' && a !== null && b !== null) {",
      "    const keysA = Object.keys(a);",
      "    const keysB = Object.keys(b);",
      "    if (keysA.length !== keysB.length) return false;",
      "    return keysA.every((k) => deepEqual(a[k], b[k]));",
      "  }",
      "  return false;",
      "}",
      "",
      "async function run() {",
      `  const cases = ${casesJson};`,
      "  const sol = new (Solution as any)();",
      `  const fnName = ${JSON.stringify(functionName)};`,
      "  const fn = sol[fnName] || sol[Object.keys(Object.getPrototypeOf(sol)).find((k) => k !== 'constructor') || 'solve'];",
      "",
      "  if (typeof fn !== 'function') {",
      "    console.log(JSON.stringify({ error: 'Solver method not found on Solution class' }));",
      "    process.exit(0);",
      "  }",
      "",
      "  const caseResults: any[] = [];",
      "  let allPassed = true;",
      "  const totalStart = performance.now();",
      "",
      "  for (const c of cases) {",
      "    const inputArgs = c.input || {};",
      "    const argsArray = Object.values(inputArgs);",
      "    const expected = c.expected;",
      "",
      "    const start = performance.now();",
      "    let actual: any = null;",
      "    let passed = false;",
      "    let error: string | undefined;",
      "",
      "    try {",
      "      actual = fn.apply(sol, argsArray);",
      "      const durationMs = Math.round((performance.now() - start) * 100) / 100;",
      "      if (expected !== null && expected !== undefined) {",
      "        passed = deepEqual(actual, expected);",
      "      } else {",
      "        passed = true;",
      "      }",
      "    } catch (err: any) {",
      "      error = String(err && err.message ? err.message : err);",
      "      passed = false;",
      "    }",
      "",
      "    if (!passed) allPassed = false;",
      "",
      "    caseResults.push({",
      "      id: c.id,",
      "      input: inputArgs,",
      "      expected,",
      "      actual,",
      "      passed,",
      "      durationMs: Math.round((performance.now() - start) * 100) / 100,",
      "      error",
      "    });",
      "  }",
      "",
      "  const totalDurationMs = Math.round((performance.now() - totalStart) * 100) / 100;",
      "  const passedCount = caseResults.filter((r) => r.passed).length;",
      "",
      "  console.log(JSON.stringify({",
      "    allPassed,",
      "    passedCount,",
      "    totalCount: cases.length,",
      "    totalDurationMs,",
      "    caseResults",
      "  }));",
      "}",
      "",
      "run().catch((e) => {",
      "  console.log(JSON.stringify({ error: e.message }));",
      "});",
    ].join("\n");

    fs.writeFileSync(harnessPath, harnessContent, "utf-8");

    return new Promise((resolve) => {
      let isTimedOut = false;
      const child = cp.spawn("bun", [harnessPath], {
        cwd: dir,
        env: { ...process.env },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (d) => {
        stdout += d.toString();
      });

      child.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      const timer = setTimeout(() => {
        isTimedOut = true;
        child.kill("SIGKILL");
        this.cleanup(harnessPath);
        resolve({
          allPassed: false,
          passedCount: 0,
          totalCount: testCases.length,
          totalDurationMs: timeoutMs,
          caseResults: testCases.map((c) => ({
            id: c.id,
            input: c.input,
            expected: c.expected,
            actual: null,
            passed: false,
            durationMs: timeoutMs,
            error: "Time Limit Exceeded (Timeout)",
          })),
          error: `Execution timed out after ${timeoutMs}ms (Possible Infinite Loop)`,
        });
      }, timeoutMs);

      child.on("close", (code) => {
        clearTimeout(timer);
        this.cleanup(harnessPath);

        if (isTimedOut) return;

        if (stderr && !stdout) {
          resolve({
            allPassed: false,
            passedCount: 0,
            totalCount: testCases.length,
            totalDurationMs: 0,
            caseResults: [],
            error: stderr.trim(),
          });
          return;
        }

        try {
          const parsed = JSON.parse(stdout.trim());
          if (parsed.error) {
            resolve({
              allPassed: false,
              passedCount: 0,
              totalCount: testCases.length,
              totalDurationMs: 0,
              caseResults: [],
              error: parsed.error,
            });
          } else {
            resolve(parsed);
          }
        } catch {
          resolve({
            allPassed: false,
            passedCount: 0,
            totalCount: testCases.length,
            totalDurationMs: 0,
            caseResults: [],
            error: stdout || stderr || `Process exited with code ${code}`,
          });
        }
      });
    });
  }

  private cleanup(filePath: string) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }
}

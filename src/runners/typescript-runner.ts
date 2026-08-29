import type { TestCase, TestResult } from "../types";
import { BaseSubprocessRunner } from "./base-runner";

export class TypeScriptRunner extends BaseSubprocessRunner {
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

  protected getCommand(harnessPath: string): { binary: string; args: string[] } {
    return { binary: "bun", args: [harnessPath] };
  }

  protected generateHarness(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
  ): string {
    const casesJson = JSON.stringify(testCases);
    return `import { Solution } from ${JSON.stringify(solutionPath)};

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => deepEqual(val, b[idx]));
  }
  if (typeof a === "object" && a !== null && b !== null) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

async function run() {
  const cases = ${casesJson};
  const sol = new (Solution as any)();
  const fnName = ${JSON.stringify(functionName)};
  const fn = sol[fnName] || sol[Object.keys(Object.getPrototypeOf(sol)).find((k) => k !== "constructor") || "solve"];

  if (typeof fn !== "function") {
    console.log(JSON.stringify({ error: "Solver method not found on Solution class" }));
    process.exit(0);
  }

  const caseResults: any[] = [];
  let allPassed = true;
  const totalStart = performance.now();

  for (const c of cases) {
    const inputArgs = c.input || {};
    const argsArray = Object.values(inputArgs);
    const expected = c.expected;

    const start = performance.now();
    let actual: any = null;
    let passed = false;
    let error: string | undefined;

    try {
      actual = fn.apply(sol, argsArray);
      const durationMs = Math.round((performance.now() - start) * 100) / 100;
      if (expected !== null && expected !== undefined) {
        passed = deepEqual(actual, expected);
      } else {
        passed = true;
      }
    } catch (err: any) {
      error = String(err && err.message ? err.message : err);
      passed = false;
    }

    if (!passed) allPassed = false;

    caseResults.push({
      id: c.id,
      input: inputArgs,
      expected,
      actual,
      passed,
      durationMs: Math.round((performance.now() - start) * 100) / 100,
      error
    });
  }

  const totalDurationMs = Math.round((performance.now() - totalStart) * 100) / 100;
  const passedCount = caseResults.filter((r) => r.passed).length;

  console.log(JSON.stringify({
    allPassed,
    passedCount,
    totalCount: cases.length,
    totalDurationMs,
    caseResults
  }));
}

run().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
});
`;
  }
}

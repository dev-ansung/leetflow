import type { TestCase, TestResult } from "../types";
import { BaseSubprocessRunner } from "./base-runner";

export class PythonRunner extends BaseSubprocessRunner {
  readonly language = "python";
  readonly fileExtension = ".py";

  static async runTests(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
    timeoutMs: number = 4000,
  ): Promise<TestResult> {
    const runner = new PythonRunner();
    return runner.runTests(solutionPath, functionName, testCases, timeoutMs);
  }

  protected getCommand(harnessPath: string): { binary: string; args: string[] } {
    return { binary: "python3", args: [harnessPath] };
  }

  protected generateHarness(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
  ): string {
    const casesJson = JSON.stringify(testCases);
    return `
import sys
import json
import time
import importlib.util

def deep_equal(a, b):
    if a == b:
        return True
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(deep_equal(x, y) for x, y in zip(a, b))
    return False

def run_all():
    cases = json.loads(${JSON.stringify(casesJson)})
    
    spec = importlib.util.spec_from_file_location("solution", ${JSON.stringify(solutionPath)})
    if spec is None or spec.loader is None:
        print(json.dumps({"error": "Failed to load solution module"}))
        sys.exit(1)
        
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        print(json.dumps({"error": f"Syntax/Import Error: {type(e).__name__}: {str(e)}"}))
        sys.exit(0)

    if not hasattr(mod, "Solution"):
        print(json.dumps({"error": "Class Solution not found in solution.py"}))
        sys.exit(0)

    sol_instance = mod.Solution()
    target_fn = ${JSON.stringify(functionName)}
    fn = getattr(sol_instance, target_fn, None)
    if fn is None:
        import re
        snake_name = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", target_fn).lower()
        fn = getattr(sol_instance, snake_name, None)
    if fn is None:
        methods = [m for m in dir(sol_instance) if not m.startswith("_") and callable(getattr(sol_instance, m))]
        if methods:
            fn = getattr(sol_instance, methods[0])
        else:
            print(json.dumps({"error": "No callable solver method found in Solution"}))
            sys.exit(0)

    case_results = []
    all_passed = True
    total_start = time.perf_counter()

    for c in cases:
        c_id = c.get("id", 1)
        input_kwargs = c.get("input", {})
        expected = c.get("expected")

        start = time.perf_counter()
        actual = None
        passed = False
        err_msg = None

        try:
            actual = fn(**input_kwargs)
            duration_ms = (time.perf_counter() - start) * 1000.0
            
            if expected is not None:
                passed = deep_equal(actual, expected)
            else:
                passed = True
        except Exception as e:
            duration_ms = (time.perf_counter() - start) * 1000.0
            err_msg = f"{type(e).__name__}: {str(e)}"
            passed = False

        if not passed:
            all_passed = False

        case_results.append({
            "id": c_id,
            "input": input_kwargs,
            "expected": expected,
            "actual": actual,
            "passed": passed,
            "durationMs": round(duration_ms, 2),
            "error": err_msg
        })

    total_duration_ms = (time.perf_counter() - total_start) * 1000.0
    passed_count = sum(1 for r in case_results if r["passed"])

    print(json.dumps({
        "allPassed": all_passed,
        "passedCount": passed_count,
        "totalCount": len(cases),
        "totalDurationMs": round(total_duration_ms, 2),
        "caseResults": case_results
    }))

if __name__ == "__main__":
    run_all()
`;
  }
}

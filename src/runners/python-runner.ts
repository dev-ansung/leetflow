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
    return `from __future__ import annotations
import sys
import json
import time
import importlib.util
import inspect

def deep_equal(a, b):
    if a == b:
        return True
    if (a is None and b == []) or (a == [] and b is None):
        return True
    if isinstance(a, list) and isinstance(b, list):
        if len(a) != len(b):
            return False
        return all(deep_equal(x, y) for x, y in zip(a, b))
    if isinstance(a, dict) and isinstance(b, dict):
        if set(a.keys()) != set(b.keys()):
            return False
        return all(deep_equal(a[k], b[k]) for k in a)
    return False

def serialize_val(v):
    if v is None or isinstance(v, (int, float, str, bool)):
        return v
    if isinstance(v, (list, tuple)):
        return [serialize_val(x) for x in v]
    if isinstance(v, dict):
        return {k: serialize_val(val) for k, val in v.items()}
    if hasattr(v, "val") and hasattr(v, "next"):
        res = []
        curr = v
        seen = set()
        while curr:
            if id(curr) in seen:
                break
            seen.add(id(curr))
            res.append(serialize_val(curr.val))
            curr = curr.next
        return res
    if hasattr(v, "val") and hasattr(v, "left") and hasattr(v, "right"):
        from collections import deque
        res = []
        q = deque([v])
        while q:
            node = q.popleft()
            if node:
                res.append(serialize_val(node.val))
                q.append(node.left)
                q.append(node.right)
            else:
                res.append(None)
        while res and res[-1] is None:
            res.pop()
        return res
    return str(v)

def deserialize_param(val, param_name, type_hint_str, mod):
    ListNodeCls = getattr(mod, "ListNode", None)
    TreeNodeCls = getattr(mod, "TreeNode", None)

    is_list_node = (
        (type_hint_str and "ListNode" in type_hint_str) or
        param_name.lower().startswith("list") or
        param_name.lower().startswith("head") or
        param_name.lower() == "node" or
        "list_node" in param_name.lower()
    )
    if is_list_node and isinstance(val, list) and ListNodeCls:
        dummy = ListNodeCls(0)
        curr = dummy
        for x in val:
            curr.next = ListNodeCls(x)
            curr = curr.next
        return dummy.next

    is_tree_node = (
        (type_hint_str and "TreeNode" in type_hint_str) or
        param_name.lower().startswith("root") or
        param_name.lower().startswith("tree")
    )
    if is_tree_node and isinstance(val, list) and TreeNodeCls:
        if not val:
            return None
        from collections import deque
        root = TreeNodeCls(val[0])
        q = deque([root])
        i = 1
        while q and i < len(val):
            node = q.popleft()
            if i < len(val) and val[i] is not None:
                node.left = TreeNodeCls(val[i])
                q.append(node.left)
            i += 1
            if i < len(val) and val[i] is not None:
                node.right = TreeNodeCls(val[i])
                q.append(node.right)
            i += 1
        return root

    return val

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

    type_hints = {}
    try:
        sig = inspect.signature(fn)
        for p_name, param in sig.parameters.items():
            if param.annotation != inspect.Parameter.empty:
                type_hints[p_name] = str(param.annotation)
    except Exception:
        pass

    case_results = []
    all_passed = True
    total_start = time.perf_counter()

    for c in cases:
        c_id = c.get("id", 1)
        raw_inputs = c.get("input", {})
        expected = c.get("expected")

        deserialized_inputs = {}
        for p_name, p_val in raw_inputs.items():
            hint_str = type_hints.get(p_name, "")
            deserialized_inputs[p_name] = deserialize_param(p_val, p_name, hint_str, mod)

        start = time.perf_counter()
        actual = None
        passed = False
        err_msg = None

        try:
            raw_actual = fn(**deserialized_inputs)
            actual = serialize_val(raw_actual)
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
            "input": raw_inputs,
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

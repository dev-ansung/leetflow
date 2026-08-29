import * as cp from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { TestCase, TestResult } from "../types";
import type { CodeRunner } from "./runner-interface";

export abstract class BaseSubprocessRunner implements CodeRunner {
  abstract readonly language: string;
  abstract readonly fileExtension: string;

  protected abstract generateHarness(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
  ): string;

  protected abstract getCommand(harnessPath: string): { binary: string; args: string[] };

  async runTests(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
    timeoutMs: number = 4000,
  ): Promise<TestResult> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "leetflow-runner-"));
    const harnessFileName = `__harness__${this.fileExtension}`;
    const harnessPath = path.join(tmpDir, harnessFileName);

    try {
      const script = this.generateHarness(solutionPath, functionName, testCases);
      fs.writeFileSync(harnessPath, script, "utf-8");

      const { binary, args } = this.getCommand(harnessPath);

      return await new Promise<TestResult>((resolve) => {
        let isTimedOut = false;
        const child = cp.spawn(binary, args, {
          cwd: path.dirname(solutionPath),
          env: { ...process.env, PYTHONUNBUFFERED: "1" },
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
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

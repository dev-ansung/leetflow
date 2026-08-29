import * as path from "node:path";
import { CppRunner } from "./cpp-runner";
import { PythonRunner } from "./python-runner";
import type { CodeRunner } from "./runner-interface";
import { TypeScriptRunner } from "./typescript-runner";

export class RunnerFactory {
  private static runners: Map<string, CodeRunner> = new Map([
    [".py", new PythonRunner()],
    [".ts", new TypeScriptRunner()],
    [".cpp", new CppRunner()],
  ]);

  static getRunner(filePath: string): CodeRunner {
    const ext = path.extname(filePath).toLowerCase();
    const runner = RunnerFactory.runners.get(ext);
    if (!runner) {
      throw new Error(`Unsupported solution language for file extension: ${ext}`);
    }
    return runner;
  }
}

import * as path from "path";
import { CodeRunner } from "./runner-interface";
import { PythonRunner } from "./python-runner";
import { TypeScriptRunner } from "./typescript-runner";
import { CppRunner } from "./cpp-runner";

export class RunnerFactory {
  private static runners: Map<string, CodeRunner> = new Map([
    [".py", new PythonRunner()],
    [".ts", new TypeScriptRunner()],
    [".cpp", new CppRunner()],
  ]);

  static getRunner(filePath: string): CodeRunner {
    const ext = path.extname(filePath).toLowerCase();
    const runner = this.runners.get(ext);
    if (!runner) {
      throw new Error(`Unsupported solution language for file extension: ${ext}`);
    }
    return runner;
  }
}
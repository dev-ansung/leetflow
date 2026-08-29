import { TestCase, TestResult } from "../types";

export interface CodeRunner {
  readonly language: string;
  readonly fileExtension: string;
  runTests(
    solutionPath: string,
    functionName: string,
    testCases: TestCase[],
    timeoutMs?: number
  ): Promise<TestResult>;
}
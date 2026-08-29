
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface TestCase {
  id: number;
  input: Record<string, any>;
  expected: any;
  rawInput?: string;
}

export interface Problem {
  id: number;
  title: string;
  slug: string;
  difficulty: Difficulty;
  topics: string[];
  descriptionHtml: string;
  starterCode: string;
  functionName: string;
  params: { name: string; type: string }[];
  testCases: TestCase[];
  hints: string[];
  targetTimeSeconds: number;
}

export interface CaseResult {
  id: number;
  input: Record<string, any>;
  expected: any;
  actual: any;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface TestResult {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  totalDurationMs: number;
  caseResults: CaseResult[];
  error?: string;
}

export interface TopicMastery {
  topic: string;
  elo: number;
  solvedCount: number;
  lastPracticedAt: string;
  reviewIntervalDays: number;
  repetitionLevel: number;
}

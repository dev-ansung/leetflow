export type Difficulty = "Easy" | "Medium" | "Hard";

export type GradeTier = "S" | "A" | "B" | "C" | "D" | "Novice";

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

export interface UserTrendMetrics {
  grade: GradeTier;
  readinessPct: number;
  streakDays: number;
  solvedLast7Days: number;
  solvedLast30Days: number;
  smoothRatePct: number;
  averageDurationMinutes: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
}

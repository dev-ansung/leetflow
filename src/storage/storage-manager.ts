import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MetricsEngine } from "../core/metrics";
import { TrackRegistry } from "../data/track-registry";
import type { Difficulty, GradeTier, UserTrendMetrics } from "../types";

export interface StorageAdapter {
  get<T>(key: string, defaultValue: T): Promise<T>;
  update<T>(key: string, value: T): Promise<void>;
  clear?(): Promise<void>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private state: Map<string, any> = new Map();

  async get<T>(key: string, defaultValue: T): Promise<T> {
    return this.state.has(key) ? this.state.get(key) : defaultValue;
  }

  async update<T>(key: string, value: T): Promise<void> {
    this.state.set(key, value);
  }

  async clear(): Promise<void> {
    this.state.clear();
  }
}

export interface AttemptLog {
  id: string;
  problemId: number;
  slug: string;
  difficulty?: Difficulty;
  timestamp: string;
  durationSec: number;
  targetSec: number;
  thinkingSec: number;
  passed: boolean;
  zeroShot: boolean;
  frictionRating: 1 | 2 | 3 | 4;
}

export interface ProblemReviewState {
  slug: string;
  lastPracticedAt: string;
  reviewIntervalDays: number;
  nextReviewDue: string;
  repetitionLevel: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  readinessPct: number;
  attempts: AttemptLog[];
  reviews: Record<string, ProblemReviewState>;
}

export class StorageManager {
  constructor(private adapter: StorageAdapter) {}

  async getReadinessPct(): Promise<number> {
    return this.adapter.get<number>("global_readiness_pct", 0);
  }

  async setReadinessPct(pct: number): Promise<void> {
    await this.adapter.update("global_readiness_pct", Math.min(100, Math.max(0, pct)));
  }

  async getProblemReview(slug: string): Promise<ProblemReviewState> {
    const key = `review_${slug}`;
    return this.adapter.get<ProblemReviewState>(key, {
      slug,
      lastPracticedAt: "",
      reviewIntervalDays: 0,
      nextReviewDue: "",
      repetitionLevel: 0,
    });
  }

  async saveProblemReview(review: ProblemReviewState): Promise<void> {
    const key = `review_${review.slug}`;
    await this.adapter.update(key, review);
  }

  async getAttempts(): Promise<AttemptLog[]> {
    return this.adapter.get<AttemptLog[]>("attempts_history", []);
  }

  async getUserTrendMetrics(): Promise<UserTrendMetrics> {
    const attempts = await this.getAttempts();
    const readinessPct = await this.getReadinessPct();
    const grade = MetricsEngine.getGradeTier(readinessPct);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;

    let solvedLast7Days = 0;
    let solvedLast30Days = 0;
    let smoothCount = 0;
    let totalDurationSec = 0;

    const solveDays = new Set<string>();
    const passedUniqueSlugs = new Set<string>();

    let easySolved = 0;
    let mediumSolved = 0;
    let hardSolved = 0;

    for (const a of attempts) {
      const ts = new Date(a.timestamp).getTime();
      if (a.passed) {
        solveDays.add(new Date(a.timestamp).toISOString().split("T")[0]);
        if (ts >= sevenDaysAgo) solvedLast7Days++;
        if (ts >= thirtyDaysAgo) solvedLast30Days++;
        if (a.frictionRating === 1 || a.frictionRating === 2) smoothCount++;
        totalDurationSec += a.durationSec;

        if (!passedUniqueSlugs.has(a.slug)) {
          passedUniqueSlugs.add(a.slug);
          const meta = TrackRegistry.findProblem(a.slug);
          const diff = a.difficulty || meta?.difficulty || "Medium";
          if (diff === "Easy") easySolved++;
          else if (diff === "Medium") mediumSolved++;
          else if (diff === "Hard") hardSolved++;
        }
      }
    }

    const passedAttempts = attempts.filter((a) => a.passed);
    const smoothRatePct =
      passedAttempts.length > 0 ? Math.round((smoothCount / passedAttempts.length) * 100) : 100;
    const averageDurationMinutes =
      passedAttempts.length > 0 ? Math.round(totalDurationSec / passedAttempts.length / 60) : 0;

    // Calculate streak
    let streakDays = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getTime() - i * 24 * 3600 * 1000).toISOString().split("T")[0];
      if (solveDays.has(d)) {
        streakDays++;
      } else if (i > 0) {
        break;
      }
    }

    return {
      grade,
      readinessPct,
      streakDays,
      solvedLast7Days,
      solvedLast30Days,
      smoothRatePct,
      averageDurationMinutes,
      easySolved,
      mediumSolved,
      hardSolved,
    };
  }

  async recordAttempt(params: {
    problemId: number;
    slug: string;
    difficulty?: Difficulty;
    durationSec: number;
    targetSec: number;
    thinkingSec: number;
    passed: boolean;
    frictionRating: 1 | 2 | 3 | 4;
  }): Promise<{
    newReadinessPct: number;
    deltaPct: number;
    grade: GradeTier;
    nextIntervalDays: number;
  }> {
    const currentReadiness = await this.getReadinessPct();
    const difficulty: Difficulty =
      params.difficulty ||
      (params.targetSec > 2000 ? "Hard" : params.targetSec > 1000 ? "Medium" : "Easy");

    const { newReadinessPct, deltaPct, grade } = MetricsEngine.calculateReadiness(
      currentReadiness,
      difficulty,
      params.frictionRating,
      params.durationSec,
      params.targetSec,
      params.passed,
    );

    await this.setReadinessPct(newReadinessPct);

    const review = await this.getProblemReview(params.slug);
    const { nextIntervalDays, newRepetition } = MetricsEngine.calculateSM2(
      params.frictionRating,
      review.repetitionLevel,
      review.reviewIntervalDays,
    );

    const now = new Date();
    const nextDueDate = new Date(now.getTime() + nextIntervalDays * 24 * 3600 * 1000);

    review.lastPracticedAt = now.toISOString();
    review.reviewIntervalDays = nextIntervalDays;
    review.nextReviewDue = nextDueDate.toISOString();
    review.repetitionLevel = newRepetition;

    await this.saveProblemReview(review);

    const attempts = await this.getAttempts();
    const log: AttemptLog = {
      id: String(Date.now()),
      problemId: params.problemId,
      slug: params.slug,
      difficulty,
      timestamp: now.toISOString(),
      durationSec: params.durationSec,
      targetSec: params.targetSec,
      thinkingSec: params.thinkingSec,
      passed: params.passed,
      zeroShot: params.passed && params.thinkingSec < params.durationSec * 0.5,
      frictionRating: params.frictionRating,
    };
    attempts.push(log);
    await this.adapter.update("attempts_history", attempts);

    return {
      newReadinessPct,
      deltaPct,
      grade,
      nextIntervalDays,
    };
  }

  async getActiveTrackId(): Promise<string> {
    return this.adapter.get<string>("active_track_id", "blind75");
  }

  async setActiveTrackId(trackId: string): Promise<void> {
    await this.adapter.update("active_track_id", trackId);
  }

  async resetAll(): Promise<void> {
    if (this.adapter.clear) {
      await this.adapter.clear();
    } else {
      await this.adapter.update("attempts_history", []);
      await this.adapter.update("global_readiness_pct", 0);
    }
  }

  async exportAllData(): Promise<string> {
    const attempts = await this.getAttempts();
    const readinessPct = await this.getReadinessPct();
    const uniqueSlugs = Array.from(new Set(attempts.map((a) => a.slug)));
    const reviewMap: Record<string, ProblemReviewState> = {};

    for (const s of uniqueSlugs) {
      reviewMap[s] = await this.getProblemReview(s);
    }

    const backup: BackupData = {
      version: "3.0.0",
      exportedAt: new Date().toISOString(),
      readinessPct,
      attempts,
      reviews: reviewMap,
    };

    return JSON.stringify(backup, null, 2);
  }

  async importData(jsonContent: string): Promise<boolean> {
    try {
      const parsed: BackupData = JSON.parse(jsonContent);
      if (!parsed.attempts || !Array.isArray(parsed.attempts)) {
        return false;
      }

      await this.adapter.update("attempts_history", parsed.attempts);
      if (typeof parsed.readinessPct === "number") {
        await this.setReadinessPct(parsed.readinessPct);
      }

      if (parsed.reviews && typeof parsed.reviews === "object") {
        for (const [_s, r] of Object.entries(parsed.reviews)) {
          await this.saveProblemReview(r);
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async purgeWorkspace(): Promise<{ deletedCount: number }> {
    const wsDir = path.join(os.homedir(), ".leetflow", "workspace");
    let deletedCount = 0;
    if (fs.existsSync(wsDir)) {
      const entries = fs.readdirSync(wsDir);
      for (const entry of entries) {
        const fullPath = path.join(wsDir, entry);
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          deletedCount++;
        } catch {}
      }
    }
    return { deletedCount };
  }
}

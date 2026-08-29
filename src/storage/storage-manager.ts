import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MetricsEngine } from "../core/metrics";
import { CURRICULUM_DATASET } from "../data/curriculum";
import { TopicNormalizer } from "../data/topic-normalizer";
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
  topic: string;
  timestamp: string;
  durationSec: number;
  targetSec: number;
  thinkingSec: number;
  passed: boolean;
  zeroShot: boolean;
  frictionRating: 1 | 2 | 3 | 4;
}

export interface TopicMasteryState {
  topic: string;
  masteryPct: number; // 0 - 100
  grade: GradeTier;
  solvedCount: number;
  lastPracticedAt: string;
  reviewIntervalDays: number;
  nextReviewDue: string;
  repetitionLevel: number;
  elo: number;
}

export interface BackupData {
  version: string;
  exportedAt: string;
  attempts: AttemptLog[];
  mastery: Record<string, TopicMasteryState>;
}

export class StorageManager {
  constructor(private adapter: StorageAdapter) {}

  async getTopicMastery(topic: string): Promise<TopicMasteryState> {
    const canonicalTopic = TopicNormalizer.normalize("", [topic]);
    const key = `mastery_${canonicalTopic}`;

    const raw = await this.adapter.get<any>(key, {
      topic: canonicalTopic,
      masteryPct: 0,
      grade: "Novice",
      elo: 1200,
      solvedCount: 0,
      lastPracticedAt: "",
      reviewIntervalDays: 0,
      nextReviewDue: "",
      repetitionLevel: 0,
    });

    // Auto-migrate legacy Elo if masteryPct not explicitly stored
    if (typeof raw.masteryPct !== "number") {
      const legacyElo = typeof raw.elo === "number" ? raw.elo : 1200;
      raw.masteryPct = Math.min(100, Math.max(0, Math.round(((legacyElo - 1000) / 1000) * 100)));
    }
    raw.grade = MetricsEngine.getGradeTier(raw.masteryPct);
    raw.elo = typeof raw.elo === "number" ? raw.elo : 1000 + Math.round(raw.masteryPct * 10);

    return raw as TopicMasteryState;
  }

  async saveTopicMastery(mastery: TopicMasteryState): Promise<void> {
    const canonicalTopic = TopicNormalizer.normalize("", [mastery.topic]);
    mastery.topic = canonicalTopic;
    mastery.grade = MetricsEngine.getGradeTier(mastery.masteryPct);
    const key = `mastery_${canonicalTopic}`;
    await this.adapter.update(key, mastery);
  }

  async getAllMasteries(): Promise<TopicMasteryState[]> {
    const topics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
    const list: TopicMasteryState[] = [];
    for (const t of topics) {
      list.push(await this.getTopicMastery(t));
    }
    return list;
  }

  async getAttempts(): Promise<AttemptLog[]> {
    return this.adapter.get<AttemptLog[]>("attempts_history", []);
  }

  async getUserTrendMetrics(): Promise<UserTrendMetrics> {
    const attempts = await this.getAttempts();
    const masteries = await this.getAllMasteries();
    const { overallMasteryPct, overallGrade } = MetricsEngine.calculateOverallGrade(masteries);

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 3600 * 1000;
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;

    let solvedLast7Days = 0;
    let solvedLast30Days = 0;
    let smoothCount = 0;
    let totalDurationSec = 0;

    const solveDays = new Set<string>();

    for (const a of attempts) {
      const ts = new Date(a.timestamp).getTime();
      if (a.passed) {
        solveDays.add(new Date(a.timestamp).toISOString().split("T")[0]);
        if (ts >= sevenDaysAgo) solvedLast7Days++;
        if (ts >= thirtyDaysAgo) solvedLast30Days++;
        if (a.frictionRating === 1 || a.frictionRating === 2) smoothCount++;
        totalDurationSec += a.durationSec;
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
      overallGrade,
      overallMasteryPct,
      streakDays,
      solvedLast7Days,
      solvedLast30Days,
      smoothRatePct,
      averageDurationMinutes,
    };
  }

  async recordAttempt(params: {
    problemId: number;
    slug: string;
    topic: string;
    difficulty?: Difficulty;
    durationSec: number;
    targetSec: number;
    thinkingSec: number;
    passed: boolean;
    frictionRating: 1 | 2 | 3 | 4;
  }): Promise<{
    newMasteryPct: number;
    deltaPct: number;
    grade: GradeTier;
    overallGrade: GradeTier;
    overallMasteryPct: number;
    newElo: number;
    delta: number;
    nextIntervalDays: number;
  }> {
    const canonicalTopic = TopicNormalizer.normalize(params.slug, [params.topic]);
    const mastery = await this.getTopicMastery(canonicalTopic);
    const difficulty: Difficulty =
      params.difficulty ||
      (params.targetSec > 2000 ? "Hard" : params.targetSec > 1000 ? "Medium" : "Easy");

    const { newMasteryPct, deltaPct, grade } = MetricsEngine.calculateMastery(
      mastery.masteryPct,
      difficulty,
      params.frictionRating,
      params.durationSec,
      params.targetSec,
      params.passed,
    );

    const { newElo, delta } = MetricsEngine.calculateElo(
      mastery.elo,
      params.targetSec > 2000 ? 1900 : params.targetSec > 1000 ? 1600 : 1200,
      params.durationSec,
      params.targetSec,
      params.passed,
    );

    const { nextIntervalDays, newRepetition } = MetricsEngine.calculateSM2(
      params.frictionRating,
      mastery.repetitionLevel,
      mastery.reviewIntervalDays,
    );

    const now = new Date();
    const nextDueDate = new Date(now.getTime() + nextIntervalDays * 24 * 3600 * 1000);

    mastery.masteryPct = newMasteryPct;
    mastery.grade = grade;
    mastery.elo = newElo;
    mastery.solvedCount += params.passed ? 1 : 0;
    mastery.lastPracticedAt = now.toISOString();
    mastery.reviewIntervalDays = nextIntervalDays;
    mastery.nextReviewDue = nextDueDate.toISOString();
    mastery.repetitionLevel = newRepetition;

    await this.saveTopicMastery(mastery);

    const attempts = await this.getAttempts();
    const log: AttemptLog = {
      id: String(Date.now()),
      problemId: params.problemId,
      slug: params.slug,
      topic: canonicalTopic,
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

    const trend = await this.getUserTrendMetrics();

    return {
      newMasteryPct,
      deltaPct,
      grade,
      overallGrade: trend.overallGrade,
      overallMasteryPct: trend.overallMasteryPct,
      newElo,
      delta,
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
    }
  }

  async exportAllData(): Promise<string> {
    const attempts = await this.getAttempts();
    const topics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
    const masteryMap: Record<string, TopicMasteryState> = {};

    for (const t of topics) {
      masteryMap[t] = await this.getTopicMastery(t);
    }

    const backup: BackupData = {
      version: "2.0.0",
      exportedAt: new Date().toISOString(),
      attempts,
      mastery: masteryMap,
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

      if (parsed.mastery && typeof parsed.mastery === "object") {
        for (const [_t, m] of Object.entries(parsed.mastery)) {
          await this.saveTopicMastery(m);
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

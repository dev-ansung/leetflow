import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { MetricsEngine } from "../core/metrics";
import { CURRICULUM_DATASET } from "../data/curriculum";
import { TopicNormalizer } from "../data/topic-normalizer";

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
  elo: number;
  solvedCount: number;
  lastPracticedAt: string;
  reviewIntervalDays: number;
  nextReviewDue: string;
  repetitionLevel: number;
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

    return this.adapter.get<TopicMasteryState>(key, {
      topic: canonicalTopic,
      elo: 1200,
      solvedCount: 0,
      lastPracticedAt: "",
      reviewIntervalDays: 0,
      nextReviewDue: "",
      repetitionLevel: 0,
    });
  }

  async saveTopicMastery(mastery: TopicMasteryState): Promise<void> {
    const canonicalTopic = TopicNormalizer.normalize("", [mastery.topic]);
    mastery.topic = canonicalTopic;
    const key = `mastery_${canonicalTopic}`;
    await this.adapter.update(key, mastery);
  }

  async getAttempts(): Promise<AttemptLog[]> {
    return this.adapter.get<AttemptLog[]>("attempts_history", []);
  }

  async recordAttempt(params: {
    problemId: number;
    slug: string;
    topic: string;
    durationSec: number;
    targetSec: number;
    thinkingSec: number;
    passed: boolean;
    frictionRating: 1 | 2 | 3 | 4;
  }): Promise<{ newElo: number; delta: number; nextIntervalDays: number }> {
    const canonicalTopic = TopicNormalizer.normalize(params.slug, [params.topic]);
    const mastery = await this.getTopicMastery(canonicalTopic);

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

    return { newElo, delta, nextIntervalDays };
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
      version: "1.0.0",
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

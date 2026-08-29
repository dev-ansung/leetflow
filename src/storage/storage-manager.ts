import { MetricsEngine } from "../core/metrics";
import { TopicNormalizer } from "../data/topic-normalizer";

export interface StorageAdapter {
  get<T>(key: string, defaultValue: T): Promise<T>;
  update<T>(key: string, value: T): Promise<void>;
}

export class MemoryStorageAdapter implements StorageAdapter {
  private state: Map<string, any> = new Map();

  async get<T>(key: string, defaultValue: T): Promise<T> {
    return this.state.has(key) ? this.state.get(key) : defaultValue;
  }

  async update<T>(key: string, value: T): Promise<void> {
    this.state.set(key, value);
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

export class StorageManager {
  constructor(private adapter: StorageAdapter) {}

  async getTopicMastery(rawTopic: string): Promise<TopicMasteryState> {
    const canonicalTopic = TopicNormalizer.normalize("", [rawTopic]);
    const canonicalKey = `mastery_${canonicalTopic}`;

    // Check canonical key first
    let data = await this.adapter.get<TopicMasteryState | null>(canonicalKey, null);

    // If not found, search all legacy aliases
    if (!data) {
      const aliases = TopicNormalizer.getLegacyAliases(canonicalTopic);
      for (const alias of aliases) {
        const legacyKey = `mastery_${alias}`;
        const legacyData = await this.adapter.get<TopicMasteryState | null>(legacyKey, null);
        if (legacyData) {
          data = { ...legacyData, topic: canonicalTopic };
          await this.adapter.update(canonicalKey, data);
          break;
        }
      }
    }

    return (
      data || {
        topic: canonicalTopic,
        elo: 1200,
        solvedCount: 0,
        lastPracticedAt: "",
        reviewIntervalDays: 0,
        nextReviewDue: "",
        repetitionLevel: 0,
      }
    );
  }

  async saveTopicMastery(mastery: TopicMasteryState): Promise<void> {
    const canonicalTopic = TopicNormalizer.normalize("", [mastery.topic]);
    mastery.topic = canonicalTopic;
    const key = `mastery_${canonicalTopic}`;
    await this.adapter.update(key, mastery);
  }

  async getAttempts(): Promise<AttemptLog[]> {
    const rawAttempts = await this.adapter.get<AttemptLog[]>("attempts_history", []);
    let changed = false;
    for (const a of rawAttempts) {
      const canon = TopicNormalizer.normalize(a.slug, [a.topic]);
      if (a.topic !== canon) {
        a.topic = canon;
        changed = true;
      }
    }
    if (changed) {
      await this.adapter.update("attempts_history", rawAttempts);
    }
    return rawAttempts;
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
}

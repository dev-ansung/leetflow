import { CURRICULUM_DATASET, type CurriculumProblem } from "../data/curriculum";
import type { StorageManager } from "../storage/storage-manager";

export class RecommendationEngine {
  constructor(private storage: StorageManager) {}

  async recommendNext(filter?: {
    topic?: string;
    difficulty?: "Easy" | "Medium" | "Hard";
  }): Promise<CurriculumProblem> {
    let pool = CURRICULUM_DATASET;

    if (filter?.topic) {
      pool = pool.filter((p) => p.topic === filter.topic);
    }
    if (filter?.difficulty) {
      pool = pool.filter((p) => p.difficulty === filter.difficulty);
    }

    if (pool.length === 0) {
      pool = CURRICULUM_DATASET;
    }

    const attempts = await this.storage.getAttempts();
    const solvedSet = new Set(attempts.filter((a) => a.passed).map((a) => a.slug));

    // 1. Check for due spaced reviews
    const now = Date.now();
    for (const p of pool) {
      if (solvedSet.has(p.slug)) {
        const mastery = await this.storage.getTopicMastery(p.topic);
        if (mastery.nextReviewDue && new Date(mastery.nextReviewDue).getTime() <= now) {
          return p;
        }
      }
    }

    // 2. Score unattempted candidates
    let bestCandidate = pool[0];
    let highestScore = -Infinity;

    for (const p of pool) {
      const isSolved = solvedSet.has(p.slug);
      const mastery = await this.storage.getTopicMastery(p.topic);

      // Topic decay / recency weight
      let decayScore = 1.0;
      if (mastery.lastPracticedAt) {
        const daysSince = (now - new Date(mastery.lastPracticedAt).getTime()) / (24 * 3600 * 1000);
        decayScore = Math.min(2.0, 1.0 + daysSince * 0.1);
      } else {
        decayScore = 1.5; // Unpracticed topic boost
      }

      // Zone of proximal development (match difficulty to Elo)
      const targetElo = p.difficulty === "Easy" ? 1200 : p.difficulty === "Medium" ? 1600 : 2000;
      const eloDiff = Math.abs(mastery.elo - targetElo);
      const eloMatchScore = Math.max(0.2, 1.0 - eloDiff / 1000);

      const unattemptedBonus = isSolved ? 0.2 : 1.5;

      const score = decayScore * 0.4 + eloMatchScore * 0.3 + unattemptedBonus * 0.3;

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = p;
      }
    }

    return bestCandidate;
  }
}

import { CURRICULUM_DATASET } from "../data/curriculum";
import type { StorageManager, TopicMasteryState } from "../storage/storage-manager";

export interface SummaryStats {
  totalSolved: number;
  blind75Solved: number;
  blind75Total: number;
  neetCodeSolved: number;
  neetCodeTotal: number;
  zeroShotRate: number;
  avgDurationMinutes: number;
  topicMasteries: TopicMasteryState[];
  dueReviews: { topic: string; daysOverdue: number }[];
}

export class StatsCalculator {
  static async computeSummary(storage: StorageManager): Promise<SummaryStats> {
    const attempts = await storage.getAttempts();
    const passedAttempts = attempts.filter((a) => a.passed);
    const solvedSlugs = new Set(passedAttempts.map((a) => a.slug));

    const totalSolved = solvedSlugs.size;
    const blind75Problems = CURRICULUM_DATASET.filter((p) => p.isBlind75);
    const blind75Solved = blind75Problems.filter((p) => solvedSlugs.has(p.slug)).length;

    const neetCodeProblems = CURRICULUM_DATASET.filter((p) => p.isNeetCode150);
    const neetCodeSolved = neetCodeProblems.filter((p) => solvedSlugs.has(p.slug)).length;

    const zeroShotCount = passedAttempts.filter((a) => a.zeroShot).length;
    const zeroShotRate =
      passedAttempts.length > 0 ? Math.round((zeroShotCount / passedAttempts.length) * 100) : 0;

    const totalDuration = passedAttempts.reduce((sum, a) => sum + a.durationSec, 0);
    const avgDurationMinutes =
      passedAttempts.length > 0
        ? Math.round((totalDuration / passedAttempts.length / 60) * 10) / 10
        : 0;

    const topics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
    const topicMasteries: TopicMasteryState[] = [];
    const dueReviews: { topic: string; daysOverdue: number }[] = [];
    const now = Date.now();

    for (const t of topics) {
      const mastery = await storage.getTopicMastery(t);
      if (mastery.solvedCount > 0) {
        topicMasteries.push(mastery);
        if (mastery.nextReviewDue) {
          const dueTime = new Date(mastery.nextReviewDue).getTime();
          if (dueTime <= now) {
            const daysOverdue = Math.max(0, Math.round((now - dueTime) / (24 * 3600 * 1000)));
            dueReviews.push({ topic: t, daysOverdue });
          }
        }
      }
    }

    return {
      totalSolved,
      blind75Solved,
      blind75Total: blind75Problems.length,
      neetCodeSolved,
      neetCodeTotal: neetCodeProblems.length,
      zeroShotRate,
      avgDurationMinutes,
      topicMasteries,
      dueReviews,
    };
  }
}

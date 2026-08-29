import { CURRICULUM_DATASET } from "../data/curriculum";
import { TopicNormalizer } from "../data/topic-normalizer";
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

    const curriculumTopics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
    const attemptTopics = Array.from(
      new Set(attempts.map((a) => TopicNormalizer.normalize(a.slug, [a.topic]))),
    );
    const allTopics = Array.from(new Set([...curriculumTopics, ...attemptTopics]));

    const topicMasteries: TopicMasteryState[] = [];
    const dueReviews: { topic: string; daysOverdue: number }[] = [];
    const now = Date.now();

    for (const t of allTopics) {
      const canonTopic = TopicNormalizer.normalize("", [t]);

      // Calculate actual solved count from attempts for this canonical topic
      const topicPassedAttempts = passedAttempts.filter(
        (a) => TopicNormalizer.normalize(a.slug, [a.topic]) === canonTopic,
      );
      const actualSolvedCount = new Set(topicPassedAttempts.map((a) => a.slug)).size;

      if (actualSolvedCount > 0) {
        const mastery = await storage.getTopicMastery(canonTopic);
        // Ensure solved count reflects actual history
        if (mastery.solvedCount < actualSolvedCount) {
          mastery.solvedCount = actualSolvedCount;
          await storage.saveTopicMastery(mastery);
        }

        if (!topicMasteries.some((m) => m.topic === canonTopic)) {
          topicMasteries.push(mastery);
          if (mastery.nextReviewDue) {
            const dueTime = new Date(mastery.nextReviewDue).getTime();
            if (dueTime <= now) {
              const daysOverdue = Math.max(0, Math.round((now - dueTime) / (24 * 3600 * 1000)));
              dueReviews.push({ topic: canonTopic, daysOverdue });
            }
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

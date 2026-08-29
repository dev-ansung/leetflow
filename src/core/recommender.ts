import { type TrackProblem, TrackRegistry } from "../data/track-registry";
import type { StorageManager } from "../storage/storage-manager";

export interface RecommendationResult {
  problem: TrackProblem;
  reason: "due_review" | "readiness_match" | "curriculum_progression";
  confidenceScore: number;
}

export class RecommendationEngine {
  constructor(private storage: StorageManager) {}

  async recommendNext(customTrackId?: string): Promise<TrackProblem> {
    const trackId = customTrackId || (await this.storage.getActiveTrackId());
    const problems = TrackRegistry.getTrackProblems(trackId);
    const attempts = await this.storage.getAttempts();
    const passedSlugs = new Set(attempts.filter((a) => a.passed).map((a) => a.slug));
    const now = Date.now();

    // 1. Check for Due Problem Reviews (Spaced Repetition SM-2 priority)
    const dueProblems: { problem: TrackProblem; daysOverdue: number }[] = [];
    for (const p of problems) {
      if (passedSlugs.has(p.slug)) {
        const review = await this.storage.getProblemReview(p.slug);
        if (review.nextReviewDue) {
          const dueDate = new Date(review.nextReviewDue).getTime();
          if (dueDate <= now) {
            dueProblems.push({
              problem: p,
              daysOverdue: (now - dueDate) / (24 * 3600 * 1000),
            });
          }
        }
      }
    }

    if (dueProblems.length > 0) {
      dueProblems.sort((a, b) => b.daysOverdue - a.daysOverdue);
      return dueProblems[0].problem;
    }

    // 2. Recommend Unsolved Problems Matching Readiness Zone in Chronological Order
    const unsolved = problems.filter((p) => !passedSlugs.has(p.slug));
    if (unsolved.length > 0) {
      const readiness = await this.storage.getReadinessPct();

      unsolved.sort((a, b) => {
        const targetReadinessA = a.difficulty === "Easy" ? 20 : a.difficulty === "Medium" ? 55 : 85;
        const targetReadinessB = b.difficulty === "Easy" ? 20 : b.difficulty === "Medium" ? 55 : 85;

        const diffA = Math.abs(readiness - targetReadinessA);
        const diffB = Math.abs(readiness - targetReadinessB);

        if (diffA !== diffB) {
          return diffA - diffB;
        }
        return problems.indexOf(a) - problems.indexOf(b);
      });

      return unsolved[0];
    }

    // If all solved in this track, fallback to first problem
    return problems[0] || TrackRegistry.getTrackProblems("blind75")[0];
  }
}

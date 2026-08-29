import { TrackRegistry } from "../data/track-registry";
import type { AttemptLog, StorageManager } from "../storage/storage-manager";
import type { UserTrendMetrics } from "../types";

export interface SummaryStats {
  totalSolved: number;
  activeTrackName: string;
  activeTrackSolved: number;
  activeTrackTotal: number;
  blind75Solved: number;
  blind75Total: number;
  neetCodeSolved: number;
  neetCodeTotal: number;
  zeroShotRate: number;
  avgDurationMinutes: number;
  dueReviewsCount: number;
  attempts: AttemptLog[];
  frictionBreakdown: {
    trivial: number;
    smooth: number;
    struggled: number;
    looked: number;
  };
  trend: UserTrendMetrics;
}

export class StatsCalculator {
  static async computeSummary(storage: StorageManager): Promise<SummaryStats> {
    const attempts = await storage.getAttempts();
    const passedAttempts = attempts.filter((a) => a.passed);
    const solvedSlugs = new Set(passedAttempts.map((a) => a.slug));

    const totalSolved = solvedSlugs.size;

    const activeTrackId = await storage.getActiveTrackId();
    const activeTrack = TrackRegistry.getTrack(activeTrackId);
    const activeTrackProblems = TrackRegistry.getTrackProblems(activeTrack.id);
    const activeTrackSolved = activeTrackProblems.filter((p) => solvedSlugs.has(p.slug)).length;

    const blind75Problems = TrackRegistry.getTrackProblems("blind75");
    const blind75Solved = blind75Problems.filter((p) => solvedSlugs.has(p.slug)).length;

    const neetCodeProblems = TrackRegistry.getTrackProblems("neetcode150");
    const neetCodeSolved = neetCodeProblems.filter((p) => solvedSlugs.has(p.slug)).length;

    const zeroShotCount = passedAttempts.filter((a) => a.zeroShot).length;
    const zeroShotRate =
      passedAttempts.length > 0 ? Math.round((zeroShotCount / passedAttempts.length) * 100) : 0;

    const totalDuration = passedAttempts.reduce((sum, a) => sum + a.durationSec, 0);
    const avgDurationMinutes =
      passedAttempts.length > 0
        ? Math.round((totalDuration / passedAttempts.length / 60) * 10) / 10
        : 0;

    let dueReviewsCount = 0;
    const now = Date.now();
    for (const slug of solvedSlugs) {
      const review = await storage.getProblemReview(slug);
      if (review.nextReviewDue) {
        const dueTime = new Date(review.nextReviewDue).getTime();
        if (dueTime <= now) {
          dueReviewsCount++;
        }
      }
    }

    const frictionBreakdown = {
      trivial: attempts.filter((a) => a.frictionRating === 1).length,
      smooth: attempts.filter((a) => a.frictionRating === 2).length,
      struggled: attempts.filter((a) => a.frictionRating === 3).length,
      looked: attempts.filter((a) => a.frictionRating === 4).length,
    };

    const trend = await storage.getUserTrendMetrics();

    return {
      totalSolved,
      activeTrackName: activeTrack.name,
      activeTrackSolved,
      activeTrackTotal: activeTrackProblems.length,
      blind75Solved,
      blind75Total: blind75Problems.length,
      neetCodeSolved,
      neetCodeTotal: neetCodeProblems.length,
      zeroShotRate,
      avgDurationMinutes,
      dueReviewsCount,
      attempts: [...attempts].reverse(),
      frictionBreakdown,
      trend,
    };
  }
}

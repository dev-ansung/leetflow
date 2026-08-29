import { CURRICULUM_DATASET } from "../data/curriculum";
import { TrackRegistry } from "../data/track-registry";
import type { AttemptLog, StorageManager } from "../storage/storage-manager";
import type { TopicRadarMetric, UserTrendMetrics } from "../types";

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
  radarTopics: TopicRadarMetric[];
}

export class StatsCalculator {
  static computeTop6RadarTopics(attempts: AttemptLog[]): TopicRadarMetric[] {
    const tagStats: Record<string, { count: number; smoothCount: number }> = {};

    const problemMap = new Map<string, string[]>();
    for (const p of CURRICULUM_DATASET) {
      const tags = p.topics && p.topics.length > 0 ? p.topics : [p.topic];
      problemMap.set(p.slug, tags);
    }

    const passedAttempts = attempts.filter((a) => a.passed);
    const seenSlugs = new Set<string>();

    for (const a of passedAttempts) {
      if (seenSlugs.has(a.slug)) continue;
      seenSlugs.add(a.slug);

      const tags = problemMap.get(a.slug) || ["Array"];
      const isSmooth = a.frictionRating === 1 || a.frictionRating === 2;

      for (const rawTag of tags) {
        let tag = rawTag;
        if (tag === "Dynamic Programming") tag = "Dynamic Prog";
        else if (tag === "Depth-First Search" || tag === "Breadth-First Search") tag = "Graph";
        else if (tag === "Tree") tag = "Binary Tree";
        else if (tag === "Heap (Priority Queue)") tag = "Heap";
        else if (tag === "Bit Manipulation") tag = "Bit Manip";

        if (!tagStats[tag]) {
          tagStats[tag] = { count: 0, smoothCount: 0 };
        }
        tagStats[tag].count++;
        if (isSmooth) tagStats[tag].smoothCount++;
      }
    }

    const sortedTags = Object.keys(tagStats).sort((a, b) => tagStats[b].count - tagStats[a].count);

    const defaultFill = [
      "Array",
      "Two Pointers",
      "Dynamic Prog",
      "Binary Tree",
      "Graph",
      "Greedy",
      "Binary Search",
      "Stack",
    ];

    const chosenTags: string[] = [];
    for (const t of sortedTags) {
      if (chosenTags.length >= 6) break;
      chosenTags.push(t);
    }

    for (const fallback of defaultFill) {
      if (chosenTags.length >= 6) break;
      if (!chosenTags.includes(fallback)) {
        chosenTags.push(fallback);
      }
    }

    return chosenTags.slice(0, 6).map((t) => {
      const stat = tagStats[t] || { count: 0, smoothCount: 0 };
      const smoothRate = stat.count > 0 ? Math.round((stat.smoothCount / stat.count) * 100) : 100;
      // Score calculation: 0-100%
      const volumeScore = Math.min(75, stat.count * 15);
      const score =
        stat.count > 0
          ? Math.min(100, Math.max(20, Math.round(volumeScore + smoothRate * 0.25)))
          : 15;

      return {
        name: t,
        score,
        solvedCount: stat.count,
        smoothRate,
      };
    });
  }

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
    const radarTopics = StatsCalculator.computeTop6RadarTopics(attempts);

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
      radarTopics,
    };
  }
}

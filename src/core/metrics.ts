
export class MetricsEngine {
  /**
   * Calculates adjusted Elo rating based on solve speed and difficulty.
   * @param currentElo Current topic Elo (default 1200)
   * @param problemRating Estimated problem difficulty (1200 Easy, 1600 Medium, 2000 Hard)
   * @param durationSec Total solve time in seconds
   * @param targetSec Benchmark solve time in seconds
   * @param passed Whether all test cases passed
   */
  static calculateElo(
    currentElo: number,
    problemRating: number,
    durationSec: number,
    targetSec: number,
    passed: boolean
  ): { newElo: number; delta: number } {
    const K = 32;
    const expectedScore = 1 / (1 + Math.pow(10, (problemRating - currentElo) / 400));
    
    let actualScore = 0;
    if (passed) {
      // Speed multiplier: faster solve = higher score bonus (0.8 to 1.2)
      const speedRatio = targetSec / Math.max(durationSec, 60);
      actualScore = speedRatio >= 1.0 ? Math.min(1.2, 0.9 + speedRatio * 0.1) : Math.max(0.6, speedRatio * 0.9);
    }

    const delta = Math.round(K * (actualScore - expectedScore));
    const newElo = Math.max(800, currentElo + delta);

    return { newElo, delta };
  }

  /**
   * SuperMemo-2 Spaced Repetition Algorithm.
   * @param rating User cognitive friction rating (1: Trivial, 2: Smooth, 3: Struggled, 4: Looked at solution)
   * @param repetition Previous successful review count
   * @param previousInterval Previous review interval in days
   */
  static calculateSM2(
    rating: 1 | 2 | 3 | 4,
    repetition: number,
    previousInterval: number
  ): { nextIntervalDays: number; newRepetition: number } {
    // Convert 1-4 scale to SM-2 quality (5: Trivial, 4: Smooth, 2: Struggled, 0: Failed)
    const qualityMap: Record<number, number> = { 1: 5, 2: 4, 3: 2, 4: 0 };
    const q = qualityMap[rating] ?? 3;

    if (q < 3) {
      // Failed recall: reset to 1 day interval
      return { nextIntervalDays: 1, newRepetition: 0 };
    }

    let newInterval: number;
    if (repetition === 0) {
      newInterval = 1;
    } else if (repetition === 1) {
      newInterval = 6;
    } else {
      const easeFactor = Math.max(1.3, 2.5 + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
      newInterval = Math.round(previousInterval * easeFactor);
    }

    return {
      nextIntervalDays: newInterval,
      newRepetition: repetition + 1,
    };
  }
}

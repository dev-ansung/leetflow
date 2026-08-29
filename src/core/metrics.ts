import type { Difficulty, GradeTier, TopicMastery } from "../types";

export class MetricsEngine {
  /**
   * Returns letter grade tier based on mastery percentage (0 - 100%).
   */
  static getGradeTier(masteryPct: number): GradeTier {
    if (masteryPct >= 90) return "S";
    if (masteryPct >= 80) return "A";
    if (masteryPct >= 65) return "B";
    if (masteryPct >= 50) return "C";
    if (masteryPct >= 35) return "D";
    return "Novice";
  }

  /**
   * Calculates new 0-100% mastery percentage after an attempt.
   */
  static calculateMastery(
    currentMasteryPct: number,
    difficulty: Difficulty,
    rating: 1 | 2 | 3 | 4,
    durationSec: number,
    targetSec: number,
    passed: boolean,
  ): { newMasteryPct: number; deltaPct: number; grade: GradeTier } {
    if (!passed) {
      const deltaPct = -2;
      const newMasteryPct = Math.max(0, currentMasteryPct + deltaPct);
      return {
        newMasteryPct,
        deltaPct,
        grade: MetricsEngine.getGradeTier(newMasteryPct),
      };
    }

    // 1. Base credit by problem difficulty
    const baseCredit = difficulty === "Easy" ? 6 : difficulty === "Medium" ? 10 : 16;

    // 2. Friction multiplier
    // 1: Trivial (1.2x), 2: Smooth (1.0x), 3: Struggled (0.5x), 4: Looked at solution (+1% flat)
    let frictionMultiplier = 1.0;
    if (rating === 1) frictionMultiplier = 1.25;
    else if (rating === 2) frictionMultiplier = 1.0;
    else if (rating === 3) frictionMultiplier = 0.5;
    else if (rating === 4) frictionMultiplier = 0.15;

    // 3. Speed bonus / penalty
    const speedRatio = targetSec > 0 ? targetSec / Math.max(durationSec, 60) : 1.0;
    const speedBonus =
      speedRatio >= 1.0 ? Math.min(1.15, 0.95 + speedRatio * 0.05) : Math.max(0.8, speedRatio);

    // 4. Diminishing returns curve as mastery approaches 100%
    const headroomFactor = Math.max(0.2, (100 - currentMasteryPct) / 100);
    const rawGain = baseCredit * frictionMultiplier * speedBonus * headroomFactor;
    const deltaPct = Math.max(1, Math.round(rawGain));
    const newMasteryPct = Math.min(100, Math.max(0, currentMasteryPct + deltaPct));

    return {
      newMasteryPct,
      deltaPct,
      grade: MetricsEngine.getGradeTier(newMasteryPct),
    };
  }

  /**
   * Computes overall weighted performance grade and readiness percentage.
   */
  static calculateOverallGrade(topicMasteries: TopicMastery[]): {
    overallMasteryPct: number;
    overallGrade: GradeTier;
  } {
    if (!topicMasteries || topicMasteries.length === 0) {
      return { overallMasteryPct: 0, overallGrade: "Novice" };
    }

    const totalMastery = topicMasteries.reduce((sum, tm) => sum + (tm.masteryPct || 0), 0);
    const overallMasteryPct = Math.round(totalMastery / topicMasteries.length);
    const overallGrade = MetricsEngine.getGradeTier(overallMasteryPct);

    return {
      overallMasteryPct,
      overallGrade,
    };
  }

  /**
   * Legacy backward-compatible Elo calculation.
   */
  static calculateElo(
    currentElo: number,
    problemRating: number,
    durationSec: number,
    targetSec: number,
    passed: boolean,
  ): { newElo: number; delta: number } {
    const K = 32;
    const expectedScore = 1 / (1 + 10 ** ((problemRating - currentElo) / 400));

    let actualScore = 0;
    if (passed) {
      const speedRatio = targetSec / Math.max(durationSec, 60);
      actualScore =
        speedRatio >= 1.0 ? Math.min(1.2, 0.9 + speedRatio * 0.1) : Math.max(0.6, speedRatio * 0.9);
    }

    const delta = Math.round(K * (actualScore - expectedScore));
    const newElo = Math.max(800, currentElo + delta);

    return { newElo, delta };
  }

  /**
   * SuperMemo-2 Spaced Repetition Algorithm.
   */
  static calculateSM2(
    rating: 1 | 2 | 3 | 4,
    repetition: number,
    previousInterval: number,
  ): { nextIntervalDays: number; newRepetition: number } {
    const qualityMap: Record<number, number> = { 1: 5, 2: 4, 3: 2, 4: 0 };
    const q = qualityMap[rating] ?? 3;

    if (q < 3) {
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

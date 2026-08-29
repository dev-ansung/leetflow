import type { Difficulty, GradeTier } from "../types";

export class MetricsEngine {
  /**
   * Returns letter grade tier based on readiness percentage (0 - 100%).
   */
  static getGradeTier(readinessPct: number): GradeTier {
    if (readinessPct >= 90) return "S";
    if (readinessPct >= 80) return "A";
    if (readinessPct >= 65) return "B";
    if (readinessPct >= 50) return "C";
    if (readinessPct >= 35) return "D";
    return "Novice";
  }

  /**
   * Calculates new global 0-100% interview readiness percentage after an attempt.
   */
  static calculateReadiness(
    currentReadinessPct: number,
    difficulty: Difficulty,
    rating: 1 | 2 | 3 | 4,
    durationSec: number,
    targetSec: number,
    passed: boolean,
  ): { newReadinessPct: number; deltaPct: number; grade: GradeTier } {
    if (!passed) {
      const deltaPct = -2;
      const newReadinessPct = Math.max(0, currentReadinessPct + deltaPct);
      return {
        newReadinessPct,
        deltaPct,
        grade: MetricsEngine.getGradeTier(newReadinessPct),
      };
    }

    // 1. Base credit by problem difficulty
    const baseCredit = difficulty === "Easy" ? 4 : difficulty === "Medium" ? 8 : 14;

    // 2. Friction multiplier
    let frictionMultiplier = 1.0;
    if (rating === 1) frictionMultiplier = 1.25;
    else if (rating === 2) frictionMultiplier = 1.0;
    else if (rating === 3) frictionMultiplier = 0.5;
    else if (rating === 4) frictionMultiplier = 0.15;

    // 3. Speed bonus / penalty
    const speedRatio = targetSec > 0 ? targetSec / Math.max(durationSec, 60) : 1.0;
    const speedBonus =
      speedRatio >= 1.0 ? Math.min(1.15, 0.95 + speedRatio * 0.05) : Math.max(0.8, speedRatio);

    // 4. Diminishing returns curve as readiness approaches 100%
    const headroomFactor = Math.max(0.15, (100 - currentReadinessPct) / 100);
    const rawGain = baseCredit * frictionMultiplier * speedBonus * headroomFactor;
    const deltaPct = Math.max(1, Math.round(rawGain));
    const newReadinessPct = Math.min(100, Math.max(0, currentReadinessPct + deltaPct));

    return {
      newReadinessPct,
      deltaPct,
      grade: MetricsEngine.getGradeTier(newReadinessPct),
    };
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

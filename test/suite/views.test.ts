import { describe, expect, it } from "bun:test";
import { MemoryStorageAdapter, StorageManager } from "../../src/storage/storage-manager";
import { StatsCalculator } from "../../src/views/stats-calculator";

describe("Stats Dashboard & Telemetry Analytics Suite", () => {
  it("should calculate aggregate statistics across readiness, difficulty balance, and solve times", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());

    // Record attempts
    await storage.recordAttempt({
      problemId: 1,
      slug: "two-sum",
      difficulty: "Easy",
      durationSec: 400,
      targetSec: 900,
      thinkingSec: 50,
      passed: true,
      frictionRating: 2,
    });

    await storage.recordAttempt({
      problemId: 70,
      slug: "climbing-stairs",
      difficulty: "Easy",
      durationSec: 300,
      targetSec: 600,
      thinkingSec: 40,
      passed: true,
      frictionRating: 1,
    });

    const stats = await StatsCalculator.computeSummary(storage);
    expect(stats.totalSolved).toBe(2);
    expect(stats.zeroShotRate).toBeGreaterThan(0);
    expect(stats.avgDurationMinutes).toBeGreaterThan(0);
    expect(stats.trend.readinessPct).toBeGreaterThan(0);
    expect(stats.trend.easySolved).toBe(2);
    expect(stats.radarTopics.length).toBe(6);
    expect(stats.radarTopics[0].score).toBeGreaterThanOrEqual(0);
  });
});

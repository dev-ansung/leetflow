import { describe, expect, it } from "bun:test";
import { MemoryStorageAdapter, StorageManager } from "../../src/storage/storage-manager";
import { StatsCalculator } from "../../src/views/stats-calculator";

describe("Stats Dashboard & Telemetry Analytics Suite", () => {
  it("should calculate aggregate statistics across topics and solve times", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());

    // Record attempts across multiple topics
    await storage.recordAttempt({
      problemId: 1,
      slug: "two-sum",
      topic: "Array & Hashing",
      durationSec: 400,
      targetSec: 900,
      thinkingSec: 50,
      passed: true,
      frictionRating: 2,
    });

    await storage.recordAttempt({
      problemId: 70,
      slug: "climbing-stairs",
      topic: "Dynamic Programming",
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
    expect(stats.topicMasteries.length).toBeGreaterThanOrEqual(2);
  });
});

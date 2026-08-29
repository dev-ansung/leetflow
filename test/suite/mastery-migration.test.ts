import { describe, expect, it } from "bun:test";
import { MemoryStorageAdapter, StorageManager } from "../../src/storage/storage-manager";
import { StatsCalculator } from "../../src/views/stats-calculator";

describe("Legacy Migration & Topic Mastery Verification Suite", () => {
  it("should heal legacy attempts recorded as Array and show under Array & Hashing", async () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new StorageManager(adapter);

    // Simulate existing legacy attempts saved in older version under "Array"
    await adapter.update("attempts_history", [
      {
        id: "1",
        problemId: 1,
        slug: "two-sum",
        topic: "Array",
        timestamp: new Date().toISOString(),
        durationSec: 120,
        targetSec: 900,
        thinkingSec: 30,
        passed: true,
        zeroShot: true,
        frictionRating: 2,
      },
      {
        id: "2",
        problemId: 217,
        slug: "contains-duplicate",
        topic: "Array",
        timestamp: new Date().toISOString(),
        durationSec: 150,
        targetSec: 600,
        thinkingSec: 40,
        passed: true,
        zeroShot: true,
        frictionRating: 2,
      },
      {
        id: "3",
        problemId: 125,
        slug: "valid-palindrome",
        topic: "Two Pointers",
        timestamp: new Date().toISOString(),
        durationSec: 180,
        targetSec: 600,
        thinkingSec: 45,
        passed: true,
        zeroShot: true,
        frictionRating: 2,
      },
    ]);

    // Simulate legacy mastery_Array key
    await adapter.update("mastery_Array", {
      topic: "Array",
      elo: 1245,
      solvedCount: 2,
      lastPracticedAt: new Date().toISOString(),
      reviewIntervalDays: 1,
      nextReviewDue: new Date().toISOString(),
      repetitionLevel: 1,
    });

    const summary = await StatsCalculator.computeSummary(storage);
    expect(summary.totalSolved).toBe(3);

    const arrayMastery = summary.topicMasteries.find((m) => m.topic === "Array & Hashing");
    expect(arrayMastery).toBeDefined();
    expect(arrayMastery?.solvedCount).toBe(2);

    const twoPointersMastery = summary.topicMasteries.find((m) => m.topic === "Two Pointers");
    expect(twoPointersMastery).toBeDefined();
    expect(twoPointersMastery?.solvedCount).toBe(1);
  });
});

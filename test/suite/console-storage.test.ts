import { describe, expect, it } from "bun:test";
import { MemoryStorageAdapter, StorageManager } from "../../src/storage/storage-manager";
import { StatsCalculator } from "../../src/views/stats-calculator";

describe("Console Dashboard & Data Management Suite", () => {
  it("should record attempts, export backup JSON, and import back accurately", async () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new StorageManager(adapter);

    await storage.recordAttempt({
      problemId: 1,
      slug: "two-sum",
      topic: "Array & Hashing",
      durationSec: 120,
      targetSec: 900,
      thinkingSec: 30,
      passed: true,
      frictionRating: 2,
    });

    const exportJson = await storage.exportAllData();
    const parsed = JSON.parse(exportJson);

    expect(parsed.version).toBe("2.0.0");
    expect(parsed.attempts.length).toBe(1);
    expect(parsed.attempts[0].slug).toBe("two-sum");
    expect(parsed.mastery["Array & Hashing"]).toBeDefined();

    // Now wipe storage
    await storage.resetAll();
    const wipedSummary = await StatsCalculator.computeSummary(storage);
    expect(wipedSummary.totalSolved).toBe(0);

    // Now restore from backup
    const importSuccess = await storage.importData(exportJson);
    expect(importSuccess).toBe(true);

    const restoredSummary = await StatsCalculator.computeSummary(storage);
    expect(restoredSummary.totalSolved).toBe(1);
    expect(
      restoredSummary.topicMasteries.find((m) => m.topic === "Array & Hashing")?.solvedCount,
    ).toBe(1);
  });

  it("should compute rich stats breakdown including friction distribution and attempt ledger", async () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new StorageManager(adapter);

    await storage.recordAttempt({
      problemId: 1,
      slug: "two-sum",
      topic: "Array & Hashing",
      durationSec: 100,
      targetSec: 900,
      thinkingSec: 20,
      passed: true,
      frictionRating: 1,
    });

    await storage.recordAttempt({
      problemId: 217,
      slug: "contains-duplicate",
      topic: "Array & Hashing",
      durationSec: 150,
      targetSec: 900,
      thinkingSec: 40,
      passed: true,
      frictionRating: 3,
    });

    const summary = await StatsCalculator.computeSummary(storage);
    expect(summary.totalSolved).toBe(2);
    expect(summary.frictionBreakdown.trivial).toBe(1);
    expect(summary.frictionBreakdown.struggled).toBe(1);
    expect(summary.frictionBreakdown.smooth).toBe(0);
    expect(summary.attempts.length).toBe(2);
  });
});

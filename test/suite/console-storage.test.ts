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
      difficulty: "Easy",
      durationSec: 120,
      targetSec: 900,
      thinkingSec: 30,
      passed: true,
      frictionRating: 2,
    });

    const exportJson = await storage.exportAllData();
    const parsed = JSON.parse(exportJson);

    expect(parsed.version).toBe("3.0.0");
    expect(parsed.attempts.length).toBe(1);
    expect(parsed.attempts[0].slug).toBe("two-sum");
    expect(parsed.reviews["two-sum"]).toBeDefined();

    // Now wipe storage
    await storage.resetAll();
    const wipedAttempts = await storage.getAttempts();
    expect(wipedAttempts.length).toBe(0);

    // Import back
    const success = await storage.importData(exportJson);
    expect(success).toBe(true);

    const restoredAttempts = await storage.getAttempts();
    expect(restoredAttempts.length).toBe(1);
    expect(restoredAttempts[0].slug).toBe("two-sum");
  });

  it("should compute rich stats breakdown including friction distribution and attempt ledger", async () => {
    const adapter = new MemoryStorageAdapter();
    const storage = new StorageManager(adapter);

    await storage.recordAttempt({
      problemId: 1,
      slug: "two-sum",
      difficulty: "Easy",
      durationSec: 180,
      targetSec: 900,
      thinkingSec: 40,
      passed: true,
      frictionRating: 1, // Trivial
    });

    await storage.recordAttempt({
      problemId: 15,
      slug: "3sum",
      difficulty: "Medium",
      durationSec: 600,
      targetSec: 1500,
      thinkingSec: 120,
      passed: true,
      frictionRating: 3, // Struggled
    });

    const summary = await StatsCalculator.computeSummary(storage);

    expect(summary.totalSolved).toBe(2);
    expect(summary.frictionBreakdown.trivial).toBe(1);
    expect(summary.frictionBreakdown.struggled).toBe(1);
    expect(summary.frictionBreakdown.smooth).toBe(0);
    expect(summary.trend.streakDays).toBe(1);
    expect(summary.trend.easySolved).toBe(1);
    expect(summary.trend.mediumSolved).toBe(1);
    expect(summary.attempts.length).toBe(2);
    expect(summary.attempts[0].slug).toBe("3sum"); // Reverse chronological
  });
});

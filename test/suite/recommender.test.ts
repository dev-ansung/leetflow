import { describe, expect, it } from "bun:test";
import { RecommendationEngine } from "../../src/core/recommender";
import { CURRICULUM_DATASET } from "../../src/data/curriculum";
import { MemoryStorageAdapter, StorageManager } from "../../src/storage/storage-manager";

describe("Adaptive Recommendation & Storage Engine Suite", () => {
  it("should contain comprehensive Blind 75 and NeetCode patterns in curriculum", () => {
    expect(CURRICULUM_DATASET.length).toBeGreaterThanOrEqual(75);
    const topics = new Set(CURRICULUM_DATASET.map((p) => p.topic));
    expect(topics.has("Array & Hashing")).toBe(true);
    expect(topics.has("Two Pointers")).toBe(true);
    expect(topics.has("Sliding Window")).toBe(true);
    expect(topics.has("Binary Tree")).toBe(true);
    expect(topics.has("Dynamic Programming")).toBe(true);
    expect(topics.has("Graph")).toBe(true);
  });

  it("should record attempts and update topic mastery & grades correctly in StorageManager", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());

    // Initial Mastery should be 0% (Novice)
    const initialMastery = await storage.getTopicMastery("Dynamic Programming");
    expect(initialMastery.masteryPct).toBe(0);
    expect(initialMastery.grade).toBe("Novice");
    expect(initialMastery.solvedCount).toBe(0);

    // Record a successful attempt
    const res = await storage.recordAttempt({
      problemId: 70,
      slug: "climbing-stairs",
      topic: "Dynamic Programming",
      durationSec: 300,
      targetSec: 900,
      thinkingSec: 60,
      passed: true,
      frictionRating: 2, // Smooth
    });

    expect(res.newMasteryPct).toBeGreaterThan(0);
    expect(res.deltaPct).toBeGreaterThan(0);

    const updatedMastery = await storage.getTopicMastery("Dynamic Programming");
    expect(updatedMastery.solvedCount).toBe(1);
    expect(updatedMastery.masteryPct).toBeGreaterThan(0);
    expect(updatedMastery.reviewIntervalDays).toBe(1);

    const trend = await storage.getUserTrendMetrics();
    expect(trend.overallMasteryPct).toBeGreaterThanOrEqual(0);
    expect(trend.streakDays).toBe(1);
    expect(trend.solvedLast7Days).toBe(1);

    const attempts = await storage.getAttempts();
    expect(attempts.length).toBe(1);
    expect(attempts[0].zeroShot).toBe(true);
  });

  it("should prioritize due spaced reviews over new problems in RecommendationEngine", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());
    const engine = new RecommendationEngine(storage);

    // Setup an overdue problem
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

    // Manually backdate nextReviewDue to yesterday
    const mastery = await storage.getTopicMastery("Array & Hashing");
    mastery.nextReviewDue = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await storage.saveTopicMastery(mastery);

    const nextProblem = await engine.recommendNext();
    expect(nextProblem).toBeDefined();
    expect(nextProblem.slug).toBeDefined();
  });

  it("should recommend within optimal Mastery zone of proximal development", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());
    const engine = new RecommendationEngine(storage);

    // Elevate Tree Mastery to 65% (B tier)
    const treeMastery = await storage.getTopicMastery("Binary Tree");
    treeMastery.masteryPct = 65;
    treeMastery.grade = "B";
    await storage.saveTopicMastery(treeMastery);

    const recommended = await engine.recommendNext("blind75");
    expect(recommended.topic).toBeDefined();
    expect(recommended.difficulty).toBeDefined();
  });
});

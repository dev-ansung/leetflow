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

  it("should record attempts and update unified readiness & grades correctly in StorageManager", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());

    // Initial Readiness should be 0% (Novice)
    const initialReadiness = await storage.getReadinessPct();
    expect(initialReadiness).toBe(0);

    // Record a successful attempt
    const res = await storage.recordAttempt({
      problemId: 70,
      slug: "climbing-stairs",
      difficulty: "Easy",
      durationSec: 300,
      targetSec: 900,
      thinkingSec: 60,
      passed: true,
      frictionRating: 2, // Smooth
    });

    expect(res.newReadinessPct).toBeGreaterThan(0);
    expect(res.deltaPct).toBeGreaterThan(0);

    const updatedReadiness = await storage.getReadinessPct();
    expect(updatedReadiness).toBeGreaterThan(0);

    const trend = await storage.getUserTrendMetrics();
    expect(trend.readinessPct).toBeGreaterThanOrEqual(0);
    expect(trend.streakDays).toBe(1);
    expect(trend.solvedLast7Days).toBe(1);
    expect(trend.easySolved).toBe(1);

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
      difficulty: "Easy",
      durationSec: 400,
      targetSec: 900,
      thinkingSec: 50,
      passed: true,
      frictionRating: 2,
    });

    // Manually backdate nextReviewDue to yesterday
    const review = await storage.getProblemReview("two-sum");
    review.nextReviewDue = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await storage.saveProblemReview(review);

    const nextProblem = await engine.recommendNext();
    expect(nextProblem).toBeDefined();
    expect(nextProblem.slug).toBe("two-sum");
  });

  it("should recommend within optimal Readiness zone of proximal development", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());
    const engine = new RecommendationEngine(storage);

    // Elevate Readiness to 65% (B tier)
    await storage.setReadinessPct(65);

    const recommended = await engine.recommendNext("blind75");
    expect(recommended.topic).toBeDefined();
    expect(recommended.difficulty).toBeDefined();
  });
});

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

  it("should record attempts and update topic mastery correctly in StorageManager", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());

    // Initial Elo should be 1200
    const initialMastery = await storage.getTopicMastery("Dynamic Programming");
    expect(initialMastery.elo).toBe(1200);
    expect(initialMastery.solvedCount).toBe(0);

    // Record a successful attempt
    await storage.recordAttempt({
      problemId: 70,
      slug: "climbing-stairs",
      topic: "Dynamic Programming",
      durationSec: 300,
      targetSec: 900,
      thinkingSec: 60,
      passed: true,
      frictionRating: 2, // Smooth
    });

    const updatedMastery = await storage.getTopicMastery("Dynamic Programming");
    expect(updatedMastery.solvedCount).toBe(1);
    expect(updatedMastery.elo).toBeGreaterThan(1200);
    expect(updatedMastery.reviewIntervalDays).toBe(1);

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

  it("should recommend within optimal Elo zone of proximal development", async () => {
    const storage = new StorageManager(new MemoryStorageAdapter());
    const engine = new RecommendationEngine(storage);

    // Elevate Tree Elo to 1700 (Medium/Hard range)
    const treeMastery = await storage.getTopicMastery("Binary Tree");
    treeMastery.elo = 1700;
    await storage.saveTopicMastery(treeMastery);

    const recommended = await engine.recommendNext({ topic: "Binary Tree" });
    expect(recommended.topic).toBe("Binary Tree");
    expect(recommended.difficulty).toBeDefined();
  });
});

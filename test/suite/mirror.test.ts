import { describe, expect, it } from "bun:test";
import { LeetCodeProvider } from "../../src/providers/leetcode";

describe("Mirror Sourcing & Locked Problem Test Suite", () => {
  it("should fetch LC 269 (Alien Dictionary), parse starter code and all test cases", async () => {
    const problem = await LeetCodeProvider.fetchProblem("alien-dictionary");

    expect(problem.id).toBe(269);
    expect(problem.title).toContain("Alien Dictionary");
    expect(problem.starterCode).toContain("def alien_order(self, words: list[str]) -> str:");
    expect(problem.starterCode).toContain("pass");
    expect(problem.starterCode).not.toContain("g = [[False]"); // Should be starter template, not full solution
    expect(problem.testCases.length).toBeGreaterThanOrEqual(2);
    expect(problem.testCases[0].input.words).toEqual(["wrt", "wrf", "er", "ett", "rftt"]);
    expect(problem.testCases[0].expected).toBe("wertf");
  });

  it("should fetch LC 253 (Meeting Rooms II) and parse interval test cases", async () => {
    const problem = await LeetCodeProvider.fetchProblem("meeting-rooms-ii");

    expect(problem.id).toBe(253);
    expect(problem.title).toContain("Meeting Rooms II");
    expect(problem.starterCode).toContain("min_meeting_rooms");
    expect(problem.testCases.length).toBeGreaterThanOrEqual(1);
    expect(problem.testCases[0].input.intervals).toBeDefined();
  });
});

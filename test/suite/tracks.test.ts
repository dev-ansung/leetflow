import { describe, expect, it } from "bun:test";
import { TrackRegistry } from "../../src/data/track-registry";

describe("Multi-Track Roadmap Architecture Suite", () => {
  it("should load all 6 curated roadmap JSON files", () => {
    const tracks = TrackRegistry.getAllTracks();
    expect(tracks.length).toBeGreaterThanOrEqual(6);

    const ids = tracks.map((t) => t.id);
    expect(ids).toContain("blind75");
    expect(ids).toContain("grind75");
    expect(ids).toContain("neetcode25");
    expect(ids).toContain("neetcode150");
    expect(ids).toContain("top-interview-150");
    expect(ids).toContain("carl200");
  });

  it("should contain exact counts for Blind 75 and NeetCode 25", () => {
    const b75Problems = TrackRegistry.getTrackProblems("blind75");
    expect(b75Problems.length).toBe(75);

    const nc25Problems = TrackRegistry.getTrackProblems("neetcode25");
    expect(nc25Problems.length).toBe(25);
  });

  it("should resolve problem metadata by numeric ID or slug", () => {
    const p1 = TrackRegistry.findProblem(1);
    expect(p1).toBeDefined();
    expect(p1?.slug).toBe("two-sum");

    const p11 = TrackRegistry.findProblem("container-with-most-water");
    expect(p11).toBeDefined();
    expect(p11?.id).toBe(11);
  });

  it("should extract all unique problems across all roadmaps", () => {
    const unique = TrackRegistry.getAllUniqueProblems();
    expect(unique.length).toBeGreaterThanOrEqual(150);
    for (const p of unique) {
      expect(p.id).toBeGreaterThan(0);
      expect(p.slug).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.difficulty).toBeTruthy();
    }
  });
});

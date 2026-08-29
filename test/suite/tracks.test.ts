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

  it("should contain exact counts for all standard roadmaps", () => {
    expect(TrackRegistry.getTrackProblems("blind75").length).toBe(75);
    expect(TrackRegistry.getTrackProblems("grind75").length).toBe(75);
    expect(TrackRegistry.getTrackProblems("neetcode25").length).toBe(25);
    expect(TrackRegistry.getTrackProblems("neetcode150").length).toBe(150);
    expect(TrackRegistry.getTrackProblems("top-interview-150").length).toBe(150);
    expect(TrackRegistry.getTrackProblems("carl200").length).toBeGreaterThanOrEqual(175);
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
    expect(unique.length).toBeGreaterThanOrEqual(180);
    for (const p of unique) {
      expect(p.id).toBeGreaterThan(0);
      expect(p.slug).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.difficulty).toBeTruthy();
    }
  });
});

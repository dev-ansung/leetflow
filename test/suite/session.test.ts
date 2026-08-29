import { describe, expect, it } from "bun:test";
import { SessionManager } from "../../src/core/session-manager";
import type { Problem } from "../../src/types";

describe("SessionManager Lifecycle & Telemetry Suite", () => {
  const dummyProblem: Problem = {
    id: 1,
    title: "Two Sum",
    slug: "two-sum",
    difficulty: "Easy",
    topics: ["Array & Hashing"],
    descriptionHtml: "<p>Sample</p>",
    starterCode: "class Solution: pass",
    functionName: "two_sum",
    params: [],
    testCases: [],
    hints: [],
    targetTimeSeconds: 900,
  };

  it("should initialize with no active session", () => {
    const sm = new SessionManager();
    expect(sm.hasActiveSession()).toBe(false);
    expect(sm.currentProblem).toBeUndefined();
  });

  it("should start problem session and track duration and thinking time", async () => {
    const sm = new SessionManager();
    sm.startSession(dummyProblem);

    expect(sm.hasActiveSession()).toBe(true);
    expect(sm.currentProblem?.title).toBe("Two Sum");

    await new Promise((r) => setTimeout(r, 50));
    sm.recordFirstRun();

    const metrics = sm.getMetrics();
    expect(metrics.durationSec).toBeGreaterThanOrEqual(0);
    expect(metrics.thinkingSec).toBeGreaterThanOrEqual(0);

    sm.clear();
    expect(sm.hasActiveSession()).toBe(false);
    expect(sm.currentProblem).toBeUndefined();
  });

  it("should pause and resume stopwatch correctly", async () => {
    const sm = new SessionManager();
    sm.startSession(dummyProblem);

    expect(sm.isPaused).toBe(false);

    // Pause timer
    const isPaused = sm.togglePause();
    expect(isPaused).toBe(true);
    expect(sm.isPaused).toBe(true);

    const pausedSec = sm.getElapsedSec();
    await new Promise((r) => setTimeout(r, 60));
    // Time should not advance while paused
    expect(sm.getElapsedSec()).toBe(pausedSec);

    // Resume timer
    const resumedState = sm.togglePause();
    expect(resumedState).toBe(false);
    expect(sm.isPaused).toBe(false);
  });
});

import type { Problem } from "../types";

export interface SessionMetrics {
  durationSec: number;
  durationMin: number;
  thinkingSec: number;
}

export class SessionManager {
  private _currentProblem?: Problem;
  private _sessionStartTime = 0;
  private _firstRunTime = 0;

  get currentProblem(): Problem | undefined {
    return this._currentProblem;
  }

  get sessionStartTime(): number {
    return this._sessionStartTime;
  }

  hasActiveSession(): boolean {
    return this._currentProblem !== undefined;
  }

  startSession(problem: Problem): void {
    this._currentProblem = problem;
    this._sessionStartTime = Date.now();
    this._firstRunTime = 0;
  }

  recordFirstRun(): void {
    if (this._firstRunTime === 0) {
      this._firstRunTime = Date.now();
    }
  }

  getMetrics(): SessionMetrics {
    const now = Date.now();
    const durationSec = Math.max(1, Math.round((now - this._sessionStartTime) / 1000));
    const durationMin = Math.max(1, Math.round(durationSec / 60));
    const thinkingSec =
      this._firstRunTime > 0
        ? Math.round((this._firstRunTime - this._sessionStartTime) / 1000)
        : durationSec;

    return {
      durationSec,
      durationMin,
      thinkingSec,
    };
  }

  clear(): void {
    this._currentProblem = undefined;
    this._sessionStartTime = 0;
    this._firstRunTime = 0;
  }
}

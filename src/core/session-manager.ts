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
  private _isPaused = false;
  private _pausedDuration = 0;
  private _pauseStartTime = 0;

  get currentProblem(): Problem | undefined {
    return this._currentProblem;
  }

  get sessionStartTime(): number {
    return this._sessionStartTime;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  hasActiveSession(): boolean {
    return this._currentProblem !== undefined;
  }

  startSession(problem: Problem): void {
    this._currentProblem = problem;
    this._sessionStartTime = Date.now();
    this._firstRunTime = 0;
    this._isPaused = false;
    this._pausedDuration = 0;
    this._pauseStartTime = 0;
  }

  togglePause(): boolean {
    if (!this._currentProblem) return false;
    if (!this._isPaused) {
      this._isPaused = true;
      this._pauseStartTime = Date.now();
    } else {
      this._isPaused = false;
      this._pausedDuration += Date.now() - this._pauseStartTime;
      this._pauseStartTime = 0;
    }
    return this._isPaused;
  }

  recordFirstRun(): void {
    if (this._firstRunTime === 0 && !this._isPaused) {
      this._firstRunTime = Date.now() - this._pausedDuration;
    }
  }

  getElapsedSec(): number {
    if (!this._currentProblem || this._sessionStartTime === 0) return 0;
    if (this._isPaused) {
      return Math.max(
        0,
        Math.floor((this._pauseStartTime - this._sessionStartTime - this._pausedDuration) / 1000),
      );
    }
    return Math.max(
      0,
      Math.floor((Date.now() - this._sessionStartTime - this._pausedDuration) / 1000),
    );
  }

  getMetrics(): SessionMetrics {
    const durationSec = Math.max(1, this.getElapsedSec());
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
    this._isPaused = false;
    this._pausedDuration = 0;
    this._pauseStartTime = 0;
  }
}

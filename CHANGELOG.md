# Changelog

All notable changes to the **LeetFlow** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-08-29

### Added
- **Universal Problem Sourcing**:
  - Live querying from LeetCode GraphQL API across 4,000+ problems.
  - Automatic fallback to open mirror (`doocs/leetcode`) for locked/premium questions.
  - Offline starter pack covering Blind 75 and NeetCode 150 problems.
  - Multi-format resolver supporting problem number (e.g. `11`), URL, and title search.
- **Automated Python Template Modernizer**:
  - Automatically migrates starter templates to PEP 8 `snake_case` (e.g. `two_sum`).
  - Converts outdated typing generics to PEP 585 built-in collections (`list[int]`, `dict[str, int]`).
  - Converts optional types to PEP 604 union syntax (`TreeNode | None`).
  - Automatically injects typed `ListNode` and `TreeNode` helper classes into solution files.
- **Sandboxed Multi-Language Test Runner**:
  - Sub-100ms subprocess execution sandbox with timeout guards against infinite loops.
  - Full support for Python and TypeScript test harnesses.
  - Rich diagnostics panel showing actual vs. expected diffs and execution latency.
- **Adaptive Metrics & Spaced Repetition**:
  - Topic-based Elo rating calculation with solve-speed multipliers.
  - SuperMemo-2 (SM-2) memory decay scheduling with cognitive friction tracking.
- **Native VS Code UI Integration**:
  - Activity Bar sidebar containing Practice Tracks, Blind 75 Roadmap, and Spaced Review Queue.
  - Proficiency & Telemetry tree view showing live topic Elo ratings and solve counts.
  - Interactive Stats Dashboard Webview (`LeetFlow: View Stats & Mastery`).
  - Real-time Status Bar stopwatch (`⏱ 00:00`).
# ⚡ LeetFlow: Deliberate LeetCode Mastery for VS Code

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/dev-ansung/leetflow/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-34%20passing-brightgreen.svg)]()
[![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D%201.85.0-007ACC.svg)]()
[![Linter](https://img.shields.io/badge/linter-Biome-60a5fa.svg)]()

> **Stop grinding LeetCode aimlessly in browser tabs.**  
> LeetFlow brings a cognitive-engineered deliberate practice environment directly into your VS Code editor - complete with **modern Python 3.14+ standards**, **SM-2 spaced repetition**, **topic-based Elo ratings**, and **1-click roadmap switching** across Blind 75, Grind 75, NeetCode 150, Top Interview 150, and Programmer Carl 200.

---

<!-- SCREENSHOT: Hero Showcase -->
<!-- Placeholder: Full VS Code window showing a split layout with the problem statement webview on the right, modern solution.py code in the center, and the LeetFlow Practice Tracks sidebar on the left -->
```
+-----------------------------------------------------------------------------------------+
| [Practice Tracks]   | solution.py (PEP 8 + Modern Typing) | Problem Statement Webview   |
| ⚡ Next Problem      | def two_sum(                        | #1. Two Sum                 |
| 🔀 Blind 75 (12/75) |     self,                           | Given an array of integers  |
| ▶ Array & Hashing   |     nums: list[int],                | nums and an integer target, |
| ▶ Two Pointers      |     target: int,                    | return indices of the two   |
| ▶ Sliding Window    | ) -> list[int]:                     | numbers such that they add  |
|                     |     seen: dict[int, int] = {}       | up to target...             |
+-----------------------------------------------------------------------------------------+
```

---

## 💡 Why LeetFlow? (The Value Matrix)

Most engineers fail coding interviews not because they did not solve enough problems, but because they **forgot the patterns** they solved weeks ago, or wasted mental energy wrestling with clunky web editors and outdated starter templates.

| Feature / Experience | LeetCode Web | Generic VS Code Plugins | ⚡ LeetFlow |
|:---|:---:|:---:|:---:|
| **Editor Environment** | Browser textarea | Basic file dump | **Full native VS Code IDE & shortcuts** |
| **Python Standards** | Legacy `List[int]`, camelCase | Legacy unchanged | **Modern Python 3.14+ (PEP 8, 585, 604)** |
| **Spaced Repetition** | ❌ None | ❌ None | **✔ SuperMemo-2 (SM-2) Interval Decay** |
| **Skill Calibration** | ❌ Global rank only | ❌ None | **✔ Topic-level Elo ratings (Array, DP, Tree)** |
| **Curated Roadmaps** | Manual playlist search | Hardcoded or single list | **✔ 6 Built-in Roadmaps (Blind 75, Grind 75, NeetCode, Top 150)** |
| **Locked / Premium Access** | Paywall block | Fails on locked questions | **✔ Universal mirror sourcing fallback** |
| **Execution Speed** | Remote queue latency | Variable | **✔ Sub-100ms local ephemeral sandbox** |
| **Data Privacy & Control** | Cloud locked | Local files only | **✔ JSON Backup Export/Import & Reset** |

---

## 🚀 60-Second Quick Start

1. **Open a Problem**: Click **`⚡ Next Recommended Problem`** in the sidebar, or press `Cmd+Shift+P` -> **`LeetFlow: Open Problem`** (type `#11` or paste any LeetCode link).
2. **Code in Flow State**: Write your algorithm in modern, clean Python directly in your editor.
3. **Test Instantly**: Click **`Run Tests`** (`$(beaker)`) in the editor title bar to evaluate sample cases locally in <100ms.
4. **Submit & Review**: Click **`Submit Solution`** (`$(pass-filled)`). Rate your cognitive friction (Trivial -> Looked at Solution). LeetFlow automatically updates your topic Elo and schedules your next spaced repetition review date!

---

## 🎯 Core Features & Pillars

### 1. 🔀 Multi-Track Roadmap Switcher
Switch between industry-standard interview preparation roadmaps with a single click. LeetFlow tracks your global progress so solving a problem in one roadmap automatically checks it off across all others:

* **Blind 75** (Yangshun Tay definitive 75 questions)
* **Grind 75** (Tech Interview Handbook time-optimized roadmap)
* **NeetCode 25 & NeetCode 150** (Comprehensive pattern taxonomy)
* **Top Interview 150** (LeetCode official interview study plan)
* **Programmer Carl 200** (代码随想录 progressive step-by-step curriculum)

<!-- SCREENSHOT: Practice Tracks Sidebar -->
<!-- Placeholder: Close-up of the Practice Tracks sidebar showing the Switch Roadmap quickpick and categorized folders with progress badges (e.g. Array & Hashing 7/10) -->

---

### 2. 🐍 Modern Python 3.14+ Template Engine
LeetCode default templates are stuck in Python 2/early-Python 3 conventions. LeetFlow automatically modernizes all problem templates on the fly:

#### ❌ Before (Default LeetCode Template):
```python
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        pass
```

#### ✔ After (LeetFlow Modernized Template):
```python
class Solution:
    def two_sum(self, nums: list[int], target: int) -> list[int]:
        # PEP 8 snake_case + PEP 585 built-in generic collections
        pass
```

* **PEP 8 Compliance**: Converts `camelCase` method names to `snake_case`.
* **PEP 585 Generics**: Replaces deprecated `typing.List`, `Dict`, `Tuple` with `list[int]`, `dict[str, int]`.
* **PEP 604 Unions**: Converts `Optional[TreeNode]` to clean pipe syntax `TreeNode | None`.
* **Auto-Injected Helpers**: Automatically provides typed `ListNode` and `TreeNode` class definitions directly in your file so your IDE language server never complains.

---

### 3. 🧠 Spaced Repetition (SM-2) & Adaptive Elo Engine
Never solve 100 problems only to forget how to traverse a graph a month later.

* **Topic-Based Elo Ratings**: Calibrates your exact mastery score per category (Dynamic Programming, Binary Search, Trees, Graphs, Sliding Window).
* **SuperMemo-2 (SM-2) Scheduling**: Calculates optimal review intervals based on your self-reported cognitive friction rating:
  * **1 - Trivial**: Instant recall (+15 Elo, long review interval).
  * **2 - Smooth**: Solved with natural flow (+10 Elo).
  * **3 - Struggled**: Needed multiple attempts or significant debugging (-5 Elo, short review interval).
  * **4 - Looked at Solution**: Required looking up the pattern (-20 Elo, resets SM-2 interval to 1 day).

<!-- SCREENSHOT: Proficiency & Telemetry Sidebar -->
<!-- Placeholder: Close-up of the Proficiency & Telemetry sidebar panel showing Total Solved, Active Roadmap %, Zero-Shot accuracy, Average Duration, and Topic Mastery Elo ratings -->

---

### 4. 🔍 Universal Sourcing & Ephemeral Sandbox
* **Open Anything**: Open problems by numeric ID (`#1`, `#269`), slug (`container-with-most-water`), or full URL (`leetcode.com` and `leetcode.cn`).
* **Locked & Premium Problem Sourcing**: Built-in fallback mirrors cleanly parse problem statements, test cases, and starter templates for premium questions with zero paywalls.
* **Isolated Subprocess Sandbox**: Runs your code in an ephemeral OS temporary directory with zero file pollution and a strict **4.0-second infinite loop guard**.

---

### 5. 📊 Interactive Console Dashboard & Data Sovereignty
Click **`Open Console & Control Dashboard`** to access the complete 3-tab interactive management center:

* **Tab 1: Telemetry & Mastery**: View your cognitive friction distribution, topic Elo ratings, and review schedule.
* **Tab 2: Attempt History Ledger**: Chronological log of every problem attempt with solve duration, date, thinking time, and friction rating.
* **Tab 3: Data Management**: Full **Export JSON Backup**, **Import Data**, and safe one-click **Reset** capability.

<!-- SCREENSHOT: Console Dashboard Webview -->
<!-- Placeholder: Screenshot of the LeetFlow Console Webview showing the 3 tabs (Telemetry, History Ledger, Data Management) with interactive statistics and charts -->

---

### 6. ⏱ Status Bar Stopwatch (with Click-to-Pause)
A clean, non-intrusive status bar stopwatch tracks your active problem solving time:

* **Active Solving**: `LeetFlow: ⏱ 04:12`
* **Paused**: `LeetFlow: ⏸ 04:12 (PAUSED)` (Click status bar to pause when taking a break or stepping away; paused time is excluded from telemetry).
* **Hover Tooltip**: Shows the active problem title and click-to-pause/resume prompt.

<!-- SCREENSHOT: Status Bar Timer -->
<!-- Placeholder: Close-up of the VS Code bottom status bar showing the LeetFlow timer in active and paused states -->

---

## ⌨️ Command Palette Reference

| Command | Action | Shortcut / Trigger |
|---|---|---|
| `LeetFlow: Next Recommended Problem` | Launches the next optimal problem calibrated to your Elo | `Cmd+Shift+P` -> `LeetFlow: Next` |
| `LeetFlow: Open Problem` | Opens problem by # (e.g. `11`), slug, or LeetCode URL | Practice Tracks header $(search) icon |
| `LeetFlow: Switch Active Roadmap Track...` | Switches between Blind 75, Grind 75, NeetCode 150, etc. | Practice Tracks header $(arrow-swap) icon |
| `LeetFlow: Run Tests` | Executes current solution against test cases in sandbox | Editor title bar $(beaker) icon |
| `LeetFlow: Submit Solution` | Submits solution, logs friction, and updates Elo | Editor title bar $(pass-filled) icon |
| `LeetFlow: Pause / Resume Stopwatch Timer` | Toggles timer pause state | Click status bar timer |
| `LeetFlow: Open Console & Control Dashboard` | Opens the full 3-tab interactive dashboard | Telemetry panel $(dashboard) icon |
| `LeetFlow: Modernize Python Solution` | Upgrades active file to PEP 8 snake_case & PEP 585/604 | `Cmd+Shift+P` -> `LeetFlow: Modernize` |

---

## 📦 Installation

### Option 1: Install from VS Code Marketplace (Recommended)
Search for **`LeetFlow`** by **`dev-ansung`** in the VS Code Extensions tab (`Cmd+Shift+X`) and click **Install**.

### Option 2: Install from GitHub Release (.vsix)
1. Download the latest `leetflow-1.0.0.vsix` from **[GitHub Releases](https://github.com/dev-ansung/leetflow/releases)**.
2. In VS Code, open Extensions (`Cmd+Shift+X`) -> Click `...` -> **Install from VSIX...**.

*Or install via terminal:*
```bash
code --install-extension leetflow-1.0.0.vsix --force
```

### Option 3: Build from Source
```bash
git clone https://github.com/dev-ansung/leetflow.git
cd leetflow
bun install
bun test
bun run package
code --install-extension artifacts/vsix/leetflow-1.0.0.vsix --force
```

---

## 🤝 Author & License

Created with ❤️ by **[dev-ansung](https://github.com/dev-ansung)**.

Licensed under the **[MIT License](LICENSE)**.

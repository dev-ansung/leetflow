# 📊 LeetFlow Proficiency & Grading Specification

This document defines the mathematical models, grading scales, cognitive friction taxonomy, and spaced repetition decay algorithms used across **LeetFlow** to compute **0-100% Topic Mastery**, **Overall Letter Grades (S/A/B/C/D)**, and **Interview Readiness Telemetry**.

---

## 1. Overall Performance Grade Scale

LeetFlow assigns an aggregate **Overall Grade** reflecting your holistic interview readiness across all standard coding interview patterns:

$$\text{Overall Mastery \%} = \frac{\sum_{i=1}^{N} \text{Topic Mastery}_i}{N}$$

| Overall Mastery % | Grade Tier | Badge | Interview Readiness Designation | Practical Capability |
|:---:|:---:|:---:|---|---|
| **90% - 100%** | **S Grade** | 🏆 `S` | **Senior / FAANG Ready** | Solves unseen Mediums in <15m, comfortable with Hard variations, zero hint reliance. |
| **80% - 89%** | **A Grade** | 🟢 `A` | **Strong Hire Candidate** | Solves 90%+ of interview Mediums smoothly within target time, solid intuition across all topics. |
| **65% - 79%** | **B Grade** | 🟡 `B` | **Solid Intermediate** | Understands core patterns (Sliding Window, Two Pointers, Trees, Basic DP), occasionally needs hints on complex graph/hard DP problems. |
| **50% - 64%** | **C Grade** | 🟠 `C` | **Foundations Established** | Comfortable with Easy problems, working on transitioning to Medium patterns. |
| **35% - 49%** | **D Grade** | 🔴 `D` | **Early Learning Stage** | Developing basic data structure syntax and initial pattern recognition. |
| **< 35%** | **Novice** | ⚪ `Novice` | **Just Starting Out** | Unranked baseline. Begins interview preparation. |

---

## 2. Topic Mastery Calculation Formula (0 - 100%)

Every topic (e.g. *Dynamic Programming*, *Trees*, *Graphs*, *Binary Search*) starts at **0%**. Solving a problem increases that topic's mastery based on difficulty, solve speed, and self-reported cognitive friction.

### The Mastery Equation
$$\Delta \text{Mastery} = \max\left(1, \text{round}\left(B_{\text{diff}} \times M_{\text{friction}} \times S_{\text{speed}} \times H_{\text{headroom}}\right)\right)$$

$$\text{New Mastery} = \min\left(100, \max\left(0, \text{Current Mastery} + \Delta \text{Mastery}\right)\right)$$

---

### Component Breakdown:

#### 1. Base Difficulty Credit ($B_{\text{diff}}$)
* **Easy**: $+6\%$ base credit
* **Medium**: $+10\%$ base credit
* **Hard**: $+16\%$ base credit

#### 2. Cognitive Friction Multiplier ($M_{\text{friction}}$)
After each successful test run, LeetFlow prompts you for your cognitive friction rating:

| Rating | Tier Label | Multiplier | Meaning |
|:---:|:---:|:---:|---|
| **1** | **Trivial** | **$1.25\times$** | Instant autopilot recall. Solution formulated with zero hesitation. |
| **2** | **Smooth** | **$1.00\times$** | Natural problem-solving flow. Solid intuition with standard debugging. |
| **3** | **Struggled** | **$0.50\times$** | Extensive trial-and-error, corner-case bugs, or major friction. |
| **4** | **Looked at Solution** | **$0.15\times$** | Needed hints or full solution lookup. Minimal exposure credit awarded. |

#### 3. Speed Factor ($S_{\text{speed}}$)
$$\text{Ratio} = \frac{T_{\text{target}}}{\max(T_{\text{duration}}, 60)}$$
* If $\text{Ratio} \ge 1.0$ (Solved faster than target): $S_{\text{speed}} = \min(1.15, 0.95 + 0.05 \times \text{Ratio})$
* If $\text{Ratio} < 1.0$ (Took longer than target): $S_{\text{speed}} = \max(0.80, \text{Ratio})$

#### 4. Diminishing Returns Headroom ($H_{\text{headroom}}$)
To ensure reaching 90%+ requires comprehensive pattern mastery rather than grinding Easy questions:
$$H_{\text{headroom}} = \max\left(0.20, \frac{100 - \text{Current Mastery}}{100}\right)$$

---

## 3. SuperMemo-2 (SM-2) Spaced Repetition

Solving a problem once is not enough; memory decays exponentially unless reinforced at calculated intervals. LeetFlow integrates the **SuperMemo-2 (SM-2)** spaced repetition algorithm:

### Quality Mapping
* Friction **1 (Trivial)** $\rightarrow$ Quality $q = 5$
* Friction **2 (Smooth)** $\rightarrow$ Quality $q = 4$
* Friction **3 (Struggled)** $\rightarrow$ Quality $q = 2$ *(Failed recall threshold)*
* Friction **4 (Solution)** $\rightarrow$ Quality $q = 0$ *(Complete failure)*

### Review Interval Schedule ($I$)
* If $q < 3$ (Struggled / Looked at solution):
  $$I = 1 \text{ day}, \quad \text{Repetition Level} = 0$$
* If $q \ge 3$ (Successful recall):
  * First repetition ($n = 0$): $I_1 = 1 \text{ day}$
  * Second repetition ($n = 1$): $I_2 = 6 \text{ days}$
  * Subsequent repetitions ($n \ge 2$): $I_n = \text{round}(I_{n-1} \times EF)$

### Ease Factor ($EF$)
$$EF = \max\left(1.30, 2.50 + \left(0.1 - (5 - q) \times (0.08 + (5 - q) \times 0.02)\right)\right)$$

---

## 4. User Trend Analytics & Velocity Telemetry

LeetFlow aggregates real-time metrics in your **Proficiency & Telemetry Sidebar** and **Interactive Console Dashboard**:

### 1. Solve Velocity
* **7-Day Velocity**: Number of problems solved in the last 7 calendar days.
* **30-Day Velocity**: Rolling monthly solve rate.
* **Daily Solve Streak**: Consecutive active practice days ($\ge 1$ problem solved per day).

### 2. Cognitive Flow Rate
$$\text{Flow Rate} = \frac{\text{Solves with Friction 1 or 2}}{\text{Total Solved}} \times 100$$
A rising Flow Rate indicates transitioning from pattern memorization to fluid intuition.

### 3. Zero-Shot Pass Rate
$$\text{Zero-Shot Rate} = \frac{\text{Solves passing all test cases on first run}}{\text{Total Solved}} \times 100$$
Demonstrates algorithmic precision and attention to edge cases before executing code.

---

## 5. Optimal Practice Strategy: Reaching S-Tier

1. **Prioritize Due Reviews**: When **`⚡ Next Recommended Problem`** suggests an overdue problem, review it immediately. Reviewing restores memory retention and prevents forgetting curve decay.
2. **Target Zone of Proximal Development**:
   * Grade **Novice / D** ($<50\%$): Practice Easy foundation problems.
   * Grade **C / B** ($50\% - 79\%$): Practice Medium core pattern problems.
   * Grade **A / S** ($80\% - 100\%$): Practice Hard problem variations and timed mock simulations.
3. **Be Honest on Friction Ratings**: Logging *Struggled* or *Looked at Solution* correctly triggers a 1-day spaced review so you re-encounter the pattern before you forget it!\n
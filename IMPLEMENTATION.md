# LeetFlow: Intelligent VS Code Extension for LeetCode Practice

> Stay in the flow with adaptive algorithm recommendations, local test runners, and spaced repetition - right inside VS Code.

---

## 1. Overview & Vision

**LeetFlow** is a native VS Code extension designed to turn your editor into an intelligent, frictionless algorithm training environment. Instead of context-switching between the browser and your IDE, LeetFlow manages the entire practice lifecycle:
1. **Intelligent Problem Recommendation**: Selects optimal problems tailored to your skill level using topic Elo ratings, memory retention decay (SuperMemo-2), and curated tracks (Blind 75 / NeetCode 150).
2. **Side-by-Side In-Editor Experience**: Renders problem statements, constraints, and hints in a native Webview alongside your typed solution.
3. **Instant Local Test Harness**: Inline CodeLens actions (`▶ Run Tests`, `✔ Submit Solution`) execute test cases against your local code in <100ms with colorized visual diffs.
4. **Deep Performance Telemetry**: Tracks thinking time, solve duration vs. target benchmarks, zero-shot first-try pass rate, and cognitive friction to continuously refine your learning curve.
5. **Universal Problem Provider**: Pre-seeded with Blind 75 for instant offline practice, queries the LeetCode GraphQL API (4,000+ problems) on demand, and falls back to open-source mirrors (`doocs/leetcode`) for locked/premium problems.

---

## 2. Architecture & Component Design

```mermaid
flowchart TD
    subgraph VSCode ["VS Code Extension Layer"]
        TreeView["Sidebar TreeView<br/>(Roadmap & Review Queue)"]
        Webview["Webview Panel<br/>(Problem Statement & Hints)"]
        CodeLens["CodeLens Provider<br/>(Inline 'Run Tests' / 'Submit')"]
        StatusBar["Status Bar Item<br/>(Session Timer & Topic Elo)"]
    end

    subgraph Core ["LeetFlow Core Engine (TypeScript)"]
        SessionMgr["Session & Stopwatch Manager"]
        RecEngine["Adaptive Recommendation Engine<br/>(Elo + SM-2 Spaced Repetition)"]
        Runner["Subprocess Sandbox Test Runner<br/>(Python / TypeScript / C++)"]
    end

    subgraph ProviderLayer ["Problem Provider & Caching Layer"]
        Manager["ProblemBankManager (Fallback Pipeline)"]
        Bundled["Bundled Blind 75 Seed (Offline)"]
        GraphQL["LeetCode GraphQL Client"]
        Mirror["doocs/leetcode Open Mirror"]
        Cache[("SQLite / Indexed Storage")]
        
        Manager --> Bundled
        Manager --> GraphQL
        Manager --> Mirror
        Manager --> Cache
    end

    TreeView --> SessionMgr
    Webview --> SessionMgr
    CodeLens --> Runner
    StatusBar --> SessionMgr

    SessionMgr --> RecEngine
    SessionMgr --> Manager
    Runner --> SessionMgr
    RecEngine --> Cache
```

---

## 3. Critical User Journeys (CUJs)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Tree as Sidebar TreeView
    participant Ext as LeetFlow Extension
    participant Web as Webview Panel
    participant Edit as Code Editor
    participant Runner as Test Runner
    participant DB as Local Cache / Storage

    Note over User,DB: CUJ 1: In-Editor Adaptive Practice Loop
    User->>Tree: Click "▶ Next Recommended Problem"
    Tree->>Ext: Request next problem
    Ext->>DB: Query topic Elo, decay curve & due reviews
    DB-->>Ext: Returns candidate (e.g. LC 322 Coin Change)
    Ext->>Web: Render problem statement, examples & constraints
    Ext->>Edit: Open workspace solution file (solution.py / solution.ts)
    Ext->>User: Start Status Bar timer (⏱ 00:00)
    User->>Edit: Implement algorithm
    User->>Edit: Click CodeLens "▶ Run Tests"
    Edit->>Runner: Execute test cases in sandbox
    Runner-->>Ext: Results (Pass/Fail, latency, diff)
    Ext-->>User: Show output in Test Panel / inline diagnostics
    User->>Edit: Click CodeLens "✔ Submit Solution"
    Ext->>Runner: Run full test suite
    Runner-->>Ext: All passed in 14m 10s (Target: 25m)
    Ext->>User: Prompt quick friction rating [1-4]
    User->>Ext: Select: "Smooth"
    Ext->>DB: Update topic Elo (+45), calculate next SM-2 review
    Ext->>Web: Show celebration card & updated mastery stats
```

---

## 4. Problem Sourcing Strategy

```mermaid
flowchart TD
    Req["Problem Request (ID, Slug, or Recommendation)"] --> CacheCheck{"Exists in Local Cache?"}
    
    CacheCheck -- "YES" --> Hit["Instant Load (100% Offline)"]
    
    CacheCheck -- "NO" --> LC_API["Query LeetCode GraphQL API"]
    
    LC_API --> IsPaid{"isPaidOnly == true<br/>AND unauthenticated?"}
    
    IsPaid -- "NO (Free / Authenticated)" --> ParseLC["Parse LeetCode HTML content<br/>+ codeSnippets + metaData"]
    
    IsPaid -- "YES (Locked Premium)" --> Mirror["Query 'doocs/leetcode' Mirror<br/>(Raw GitHub Markdown)"]
    
    Mirror --> ParseMirror["Parse Frontmatter + Description<br/>+ Python Starter Code"]
    
    ParseLC --> SaveCache["Persist to Local Cache"]
    ParseMirror --> SaveCache
    SaveCache --> Hit
```

---

## 5. Telemetry & Mastery Metrics

| Metric | Telemetry Point | Signal & Application |
|---|---|---|
| **Thinking Time** | $T_{\\text{think}}$ (Duration to 1st test run) | Measures immediate pattern recognition vs conceptual hesitation |
| **Duration Ratio** | $T_{\\text{solve}} / T_{\\text{target}}$ | Normalizes solve speed against industry standards (Easy: 15m, Med: 25m, Hard: 45m) |
| **Debug Duration** | $T_{\\text{solve}} - T_{\\text{think}}$ | Highlights edge-case anticipation and debugging efficiency |
| **Zero-Shot Pass Rate** | First-try pass without intermediate fails | High predictor of live whiteboard interview readiness |
| **Cognitive Friction** | 1 (Trivial) to 4 (Looked at solution) | Direct input to SuperMemo-2 quality score ($q$) for interval scheduling |
| **Half-Life Decay** | Days since last practiced topic ($R = e^{-\\Delta t / S}$) | Surfaces decaying topics to prevent knowledge loss |

---

## 6. Directory Structure & Technology Stack

- **Extension Host**: TypeScript / Bun (`package.json`, `esbuild`)
- **UI & Views**: VS Code Custom Webviews (Tailwind / VS Code Webview UI Toolkit) + TreeDataProvider
- **Runner Sandbox**: Node/Bun child process spawning isolated language runtimes (Python, TypeScript, C++, Java, Go)
- **Quality Gates**: `bun test`, `eslint`, `prettier`, `@vscode/test-electron`

```
leetflow/
├── package.json               # Extension manifest, commands & views
├── tsconfig.json              # Strict TypeScript config
├── IMPLEMENTATION.md          # System design & architecture blueprint
├── src/
│   ├── extension.ts           # Extension activation entrypoint
│   ├── commands/              # Command handlers (next, start, test, submit, review)
│   ├── providers/             # Problem sourcing (Bundled, GraphQL, doocs mirror)
│   │   ├── problem-manager.ts
│   │   ├── leetcode-graphql.ts
│   │   ├── doocs-mirror.ts
│   │   └── bundled-seed.ts
│   ├── core/                  # Pure business logic algorithms
│   │   ├── elo.ts             # Elo rating updates
│   │   ├── sm2.ts             # SuperMemo-2 interval math
│   │   ├── recommender.ts     # Multi-factor recommendation engine
│   │   └── telemetry.ts       # Metric calculations & session tracker
│   ├── runners/               # Test execution harnesses
│   │   ├── runner-interface.ts
│   │   ├── python-runner.ts
│   │   └── typescript-runner.ts
│   ├── storage/               # Persistence & local cache
│   │   ├── database.ts
│   │   └── repositories.ts
│   ├── views/                 # Native VS Code UI components
│   │   ├── treeview-provider.ts
│   │   ├── webview-panel.ts
│   │   ├── codelens-provider.ts
│   │   └── statusbar-item.ts
│   └── data/
│       └── blind75.json       # Pre-packaged Blind 75 offline dataset
└── test/
    ├── suite/
    │   ├── elo.test.ts
    │   ├── sm2.test.ts
    │   ├── recommender.test.ts
    │   ├── providers.test.ts
    │   └── runners.test.ts
    └── runTest.ts
```

---

## 7. Next Steps & Development Phases

1. **Phase 1: Project Scaffolding & Core Engine**
   - Initialize package with `bun`, configure TypeScript, esbuild, and test runner.
   - Implement core models, Elo rating formulas, SM-2 spaced repetition math, and unit test suite.
2. **Phase 2: Problem Sourcing & Fallback Pipeline**
   - Implement `ProblemBankManager` with bundled Blind 75, LeetCode GraphQL client, and `doocs/leetcode` mirror parser.
3. **Phase 3: Test Runners & Sandbox Execution**
   - Implement `PythonRunner` and `TypeScriptRunner` with input/output comparison, execution timeout guards, and diff formatting.
4. **Phase 4: VS Code UI Integration**
   - Implement Sidebar TreeView, problem description Webview panel, CodeLens buttons, and Status Bar stopwatch.

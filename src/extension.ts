import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { RecommendationEngine } from "./core/recommender";
import { SessionManager } from "./core/session-manager";
import { TopicNormalizer } from "./data/topic-normalizer";
import { TrackRegistry } from "./data/track-registry";
import { PythonModernizer } from "./modernizer/python-modernizer";
import { LeetCodeProvider } from "./providers/leetcode";
import { ProblemResolver } from "./providers/problem-resolver";
import { RunnerFactory } from "./runners/runner-factory";
import { type StorageAdapter, StorageManager } from "./storage/storage-manager";
import { LeetFlowConsoleWebview } from "./views/console-webview";
import { LeetFlowStatsTreeProvider } from "./views/stats-treeview";
import { LeetFlowTracksProvider } from "./views/treeview";
import { LeetFlowWebview } from "./views/webview";

let session: SessionManager;
let statusBarItem: vscode.StatusBarItem;
let timerInterval: NodeJS.Timeout | undefined;
let storage: StorageManager;
let recommender: RecommendationEngine;

class VSCodeGlobalStateAdapter implements StorageAdapter {
  constructor(private state: vscode.Memento & { keys?(): readonly string[] }) {}
  async get<T>(key: string, defaultValue: T): Promise<T> {
    return this.state.get<T>(key, defaultValue);
  }
  async update<T>(key: string, value: T): Promise<void> {
    await this.state.update(key, value);
  }
  async clear(): Promise<void> {
    const keys = this.state.keys ? this.state.keys() : [];
    for (const k of keys) {
      await this.state.update(k, undefined);
    }
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("LeetFlow extension activated.");

  session = new SessionManager();
  storage = new StorageManager(new VSCodeGlobalStateAdapter(context.globalState));
  recommender = new RecommendationEngine(storage);

  // 1. Register Sidebar TreeViews
  const tracksProvider = new LeetFlowTracksProvider(storage);
  vscode.window.registerTreeDataProvider("leetflow.tracksView", tracksProvider);

  const statsTreeProvider = new LeetFlowStatsTreeProvider(storage);
  vscode.window.registerTreeDataProvider("leetflow.statsView", statsTreeProvider);

  // 2. Register Status Bar Stopwatch
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1000);
  statusBarItem.command = "leetflow.toggleTimer";
  context.subscriptions.push(statusBarItem);

  // 3. Register Command: Next Recommended Problem
  const nextCmd = vscode.commands.registerCommand("leetflow.next", async () => {
    const rec = await recommender.recommendNext();
    await startProblemSession(rec.slug, context, tracksProvider, statsTreeProvider);
  });

  // 4. Register Command: Start Specific Problem
  const startCmd = vscode.commands.registerCommand(
    "leetflow.startProblem",
    async (slug: string) => {
      await startProblemSession(slug, context, tracksProvider, statsTreeProvider);
    },
  );

  // 5. Register Command: Run Tests
  const testCmd = vscode.commands.registerCommand("leetflow.test", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !session.hasActiveSession()) {
      vscode.window.showWarningMessage("No active LeetFlow problem session open.");
      return;
    }

    const doc = editor.document;
    await doc.save();
    session.recordFirstRun();

    const problem = session.currentProblem;
    if (!problem) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "LeetFlow: Running Test Cases...",
        cancellable: false,
      },
      async () => {
        try {
          const runner = RunnerFactory.getRunner(doc.fileName);
          const result = await runner.runTests(
            doc.fileName,
            problem.functionName,
            problem.testCases,
          );

          LeetFlowWebview.updateTestResults(result);

          if (result.allPassed) {
            vscode.window.showInformationMessage(
              `✔ All ${result.passedCount} Test Cases Passed in ${result.totalDurationMs}ms!`,
            );
          } else {
            vscode.window.showErrorMessage(
              `✘ Test Failed: ${result.passedCount}/${result.totalCount} passed. Check Webview panel for diffs.`,
            );
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`Runner error: ${err.message}`);
        }
      },
    );
  });

  // 6. Register Command: Submit Solution
  const submitCmd = vscode.commands.registerCommand("leetflow.submit", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !session.hasActiveSession()) {
      vscode.window.showWarningMessage("No active LeetFlow problem session open.");
      return;
    }

    await editor.document.save();
    const problem = session.currentProblem;
    if (!problem) return;

    const runner = RunnerFactory.getRunner(editor.document.fileName);
    const result = await runner.runTests(
      editor.document.fileName,
      problem.functionName,
      problem.testCases,
    );

    LeetFlowWebview.updateTestResults(result);

    if (!result.allPassed) {
      vscode.window.showErrorMessage(
        "Cannot submit: Not all test cases passed. Run tests and verify edge cases first.",
      );
      return;
    }

    const { durationSec, durationMin, thinkingSec } = session.getMetrics();

    const frictionChoice = await vscode.window.showQuickPick(
      [
        { label: "1 - Trivial", description: "Solved effortlessly on autopilot", value: 1 },
        { label: "2 - Smooth", description: "Solved with solid understanding", value: 2 },
        {
          label: "3 - Struggled",
          description: "Needed extensive debugging or trial-and-error",
          value: 3,
        },
        {
          label: "4 - Looked at Solution",
          description: "Could not solve without looking up answer",
          value: 4,
        },
      ],
      {
        title: `LeetFlow: Rate Cognitive Friction for #${problem.id} ${problem.title}`,
        placeHolder: "How did the solve feel?",
      },
    );

    const ratingVal = (frictionChoice?.value || 2) as 1 | 2 | 3 | 4;
    const topic = TopicNormalizer.normalize(problem.slug, problem.topics);

    const { newElo, delta, nextIntervalDays } = await storage.recordAttempt({
      problemId: problem.id,
      slug: problem.slug,
      topic,
      durationSec,
      targetSec: problem.targetTimeSeconds,
      thinkingSec,
      passed: true,
      frictionRating: ratingVal,
    });

    stopTimer();
    session.clear();
    tracksProvider.refresh();
    statsTreeProvider.refresh();

    vscode.window.showInformationMessage(
      `🎉 Problem Solved in ${durationMin}m! ${topic} Elo: ${newElo} (${delta >= 0 ? "+" : ""}${delta}). Next review scheduled in ${nextIntervalDays} days.`,
    );
  });

  // 7. Register Command: View Stats & Mastery
  const statsCmd = vscode.commands.registerCommand("leetflow.stats", () => {
    LeetFlowConsoleWebview.show(storage, () => {
      tracksProvider.refresh();
      statsTreeProvider.refresh();
    });
  });

  // 8. Register Command: Review Due Problem
  const reviewCmd = vscode.commands.registerCommand("leetflow.review", async () => {
    const rec = await recommender.recommendNext();
    await startProblemSession(rec.slug, context, tracksProvider, statsTreeProvider);
  });

  // 9. Register Command: Modernize Python Solution
  const modernizeCmd = vscode.commands.registerCommand("leetflow.modernizeSolution", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor?.document.fileName.endsWith(".py")) {
      vscode.window.showWarningMessage("Please open a Python solution file to modernize.");
      return;
    }
    const currentText = editor.document.getText();
    const modernized = PythonModernizer.modernize(currentText);
    const fullRange = new vscode.Range(
      editor.document.positionAt(0),
      editor.document.positionAt(currentText.length),
    );
    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, modernized);
    });
    vscode.window.showInformationMessage(
      "✔ Modernized template to PEP 8 snake_case & PEP 585/604 types!",
    );
  });

  // 10. Register Command: Reset Progress & Telemetry Data
  const resetCmd = vscode.commands.registerCommand("leetflow.resetProgress", async () => {
    const confirm = await vscode.window.showWarningMessage(
      "Are you sure you want to reset all LeetFlow problem attempts, Elo ratings, and telemetry data?",
      { modal: true },
      "Yes, Reset All Data",
    );
    if (confirm === "Yes, Reset All Data") {
      await storage.resetAll();
      tracksProvider.refresh();
      statsTreeProvider.refresh();
      vscode.window.showInformationMessage(
        "✔ All LeetFlow progress and telemetry data has been wiped.",
      );
    }
  });

  // 11. Register Command: Open Problem by Number, Slug, or URL
  const openProblemCmd = vscode.commands.registerCommand(
    "leetflow.openProblem",
    async (rawInput?: string) => {
      let input = rawInput;
      if (!input || typeof input !== "string") {
        input = await vscode.window.showInputBox({
          title: "LeetFlow: Open Problem",
          prompt:
            "Enter problem # (e.g. 11), title slug (e.g. container-with-most-water), or LeetCode URL",
          placeHolder: "e.g. 11 or https://leetcode.com/problems/container-with-most-water/",
        });
      }

      if (!input) return;

      try {
        const slug = await ProblemResolver.resolveSlug(input);
        await startProblemSession(slug, context, tracksProvider, statsTreeProvider);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open problem "${input}": ${err.message}`);
      }
    },
  );

  // 12. Register Command: Open Console & Control Dashboard
  const consoleCmd = vscode.commands.registerCommand("leetflow.console", () => {
    LeetFlowConsoleWebview.show(storage, () => {
      tracksProvider.refresh();
      statsTreeProvider.refresh();
    });
  });

  // 13. Register Command: Switch Active Roadmap Track
  const switchTrackCmd = vscode.commands.registerCommand("leetflow.switchTrack", async () => {
    const tracks = TrackRegistry.getAllTracks();
    const activeId = await storage.getActiveTrackId();

    const items = tracks.map((t) => {
      const pCount = TrackRegistry.getTrackProblems(t.id).length;
      const isCurrent = t.id === activeId;
      return {
        label: `${isCurrent ? "$(check) " : ""}${t.name}`,
        description: `${pCount} problems · ${t.author || "Curated"}`,
        detail: t.description,
        trackId: t.id,
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      title: "LeetFlow: Select Active Study Roadmap",
      placeHolder: "Choose your primary deliberate practice roadmap",
    });

    if (selected) {
      await storage.setActiveTrackId(selected.trackId);
      tracksProvider.refresh();
      statsTreeProvider.refresh();
      vscode.window.showInformationMessage(
        `🎯 Active roadmap: ${selected.label.replace("$(check) ", "")}!`,
      );
    }
  });

  // 14. Register Command: Pause / Resume Stopwatch Timer
  const toggleTimerCmd = vscode.commands.registerCommand("leetflow.toggleTimer", () => {
    if (!session.hasActiveSession()) {
      vscode.window.showInformationMessage("No active LeetFlow problem session.");
      return;
    }
    const isPaused = session.togglePause();
    updateTimerDisplay();
    if (isPaused) {
      vscode.window.showInformationMessage("⏸ LeetFlow timer paused. Click status bar to resume.");
    } else {
      vscode.window.showInformationMessage("▶ LeetFlow timer resumed.");
    }
  });

  context.subscriptions.push(
    nextCmd,
    startCmd,
    testCmd,
    submitCmd,
    statsCmd,
    reviewCmd,
    modernizeCmd,
    resetCmd,
    openProblemCmd,
    consoleCmd,
    switchTrackCmd,
    toggleTimerCmd,
  );
}

async function startProblemSession(
  slug: string,
  _context: vscode.ExtensionContext,
  tracksProvider?: LeetFlowTracksProvider,
  statsTreeProvider?: LeetFlowStatsTreeProvider,
) {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `LeetFlow: Loading problem ${slug}...`,
      cancellable: false,
    },
    async () => {
      try {
        const problem = await LeetCodeProvider.fetchProblem(slug);
        session.startSession(problem);

        const homeDir = os.homedir();
        const wsDir = path.join(homeDir, ".leetflow", "workspace", `${problem.id}-${problem.slug}`);
        fs.mkdirSync(wsDir, { recursive: true });

        const solutionPath = path.join(wsDir, "solution.py");
        const testsPath = path.join(wsDir, "tests.json");

        if (!fs.existsSync(solutionPath)) {
          const modernized = PythonModernizer.modernize(problem.starterCode);
          fs.writeFileSync(solutionPath, modernized, "utf-8");
        } else {
          // If existing solution contains outdated typing or missing class definitions, auto-upgrade
          const existing = fs.readFileSync(solutionPath, "utf-8");
          if (
            existing.includes("List[") ||
            existing.includes("Optional[") ||
            ((existing.includes("ListNode") || existing.includes("list_node")) &&
              !/(^|\n)class\s+ListNode[\s:(]/m.test(existing)) ||
            ((existing.includes("TreeNode") || existing.includes("tree_node")) &&
              !/(^|\n)class\s+TreeNode[\s:(]/m.test(existing))
          ) {
            const upgraded = PythonModernizer.modernize(existing);
            fs.writeFileSync(solutionPath, upgraded, "utf-8");
          }
        }
        fs.writeFileSync(testsPath, JSON.stringify(problem.testCases, null, 2), "utf-8");

        const doc = await vscode.workspace.openTextDocument(solutionPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        LeetFlowWebview.show(problem, vscode.ViewColumn.Beside);

        startTimer(problem.title);
        if (tracksProvider) tracksProvider.refresh();
        if (statsTreeProvider) statsTreeProvider.refresh();

        vscode.window.showInformationMessage(
          `Started #${problem.id} ${problem.title}. Press Run Tests in editor title bar when ready!`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to load problem: ${err.message}`);
      }
    },
  );
}

function updateTimerDisplay() {
  if (!session.currentProblem) return;
  const elapsedSec = session.getElapsedSec();
  const m = Math.floor(elapsedSec / 60);
  const s = elapsedSec % 60;
  const timeStr = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  const title = session.currentProblem.title;

  if (session.isPaused) {
    statusBarItem.text = `LeetFlow: ⏸ ${timeStr} (PAUSED)`;
    statusBarItem.tooltip = `${title} · Click to Resume Timer`;
  } else {
    statusBarItem.text = `LeetFlow: ⏱ ${timeStr}`;
    statusBarItem.tooltip = `${title} · Click to Pause Timer`;
  }
}

function startTimer(_title: string) {
  stopTimer();
  updateTimerDisplay();
  statusBarItem.show();

  timerInterval = setInterval(() => {
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = undefined;
  }
  statusBarItem.hide();
}

export function deactivate() {
  stopTimer();
}

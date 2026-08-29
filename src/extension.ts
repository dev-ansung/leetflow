import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";
import { RecommendationEngine } from "./core/recommender";
import { LeetCodeProvider } from "./providers/leetcode";
import { RunnerFactory } from "./runners/runner-factory";
import { type StorageAdapter, StorageManager } from "./storage/storage-manager";
import type { Problem } from "./types";
import { LeetFlowStatsWebview } from "./views/stats-webview";
import { LeetFlowTracksProvider } from "./views/treeview";
import { LeetFlowWebview } from "./views/webview";

let currentProblem: Problem | undefined;
let sessionStartTime: number = 0;
let firstRunTime: number = 0;
let statusBarItem: vscode.StatusBarItem;
let timerInterval: NodeJS.Timeout | undefined;
let storage: StorageManager;
let recommender: RecommendationEngine;

class VSCodeGlobalStateAdapter implements StorageAdapter {
  constructor(private state: vscode.Memento) {}
  async get<T>(key: string, defaultValue: T): Promise<T> {
    return this.state.get<T>(key, defaultValue);
  }
  async update<T>(key: string, value: T): Promise<void> {
    await this.state.update(key, value);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log("LeetFlow extension activated.");

  storage = new StorageManager(new VSCodeGlobalStateAdapter(context.globalState));
  recommender = new RecommendationEngine(storage);

  // 1. Register Sidebar TreeView
  const tracksProvider = new LeetFlowTracksProvider(storage);
  vscode.window.registerTreeDataProvider("leetflow.tracksView", tracksProvider);

  // 2. Register Status Bar Stopwatch
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "leetflow.stats";
  context.subscriptions.push(statusBarItem);

  // 3. Register Command: Next Recommended Problem
  const nextCmd = vscode.commands.registerCommand("leetflow.next", async () => {
    const rec = await recommender.recommendNext();
    await startProblemSession(rec.slug, context, tracksProvider);
  });

  // 4. Register Command: Start Specific Problem
  const startCmd = vscode.commands.registerCommand(
    "leetflow.startProblem",
    async (slug: string) => {
      await startProblemSession(slug, context, tracksProvider);
    },
  );

  // 5. Register Command: Run Tests
  const testCmd = vscode.commands.registerCommand("leetflow.test", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !currentProblem) {
      vscode.window.showWarningMessage("No active LeetFlow problem session open.");
      return;
    }

    const doc = editor.document;
    await doc.save();

    if (firstRunTime === 0) {
      firstRunTime = Date.now();
    }

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
            currentProblem?.functionName,
            currentProblem?.testCases,
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
    if (!editor || !currentProblem) {
      vscode.window.showWarningMessage("No active LeetFlow problem session open.");
      return;
    }

    await editor.document.save();

    const runner = RunnerFactory.getRunner(editor.document.fileName);
    const result = await runner.runTests(
      editor.document.fileName,
      currentProblem.functionName,
      currentProblem.testCases,
    );

    LeetFlowWebview.updateTestResults(result);

    if (!result.allPassed) {
      vscode.window.showErrorMessage(
        "Cannot submit: Not all test cases passed. Run tests and verify edge cases first.",
      );
      return;
    }

    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    const durationMin = Math.round(durationSec / 60);
    const thinkingSec =
      firstRunTime > 0 ? Math.round((firstRunTime - sessionStartTime) / 1000) : durationSec;

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
        title: `LeetFlow: Rate Cognitive Friction for #${currentProblem.id} ${currentProblem.title}`,
        placeHolder: "How did the solve feel?",
      },
    );

    const ratingVal = (frictionChoice?.value || 2) as 1 | 2 | 3 | 4;
    const topic = currentProblem.topics[0] || "Algorithms";

    const { newElo, delta, nextIntervalDays } = await storage.recordAttempt({
      problemId: currentProblem.id,
      slug: currentProblem.slug,
      topic,
      durationSec,
      targetSec: currentProblem.targetTimeSeconds,
      thinkingSec,
      passed: true,
      frictionRating: ratingVal,
    });

    stopTimer();
    tracksProvider.refresh();

    vscode.window.showInformationMessage(
      `🎉 Problem Solved in ${durationMin}m! ${topic} Elo: ${newElo} (${delta >= 0 ? "+" : ""}${delta}). Next review scheduled in ${nextIntervalDays} days.`,
    );
  });

  // 7. Register Command: View Stats & Mastery
  const statsCmd = vscode.commands.registerCommand("leetflow.stats", () => {
    LeetFlowStatsWebview.show(storage);
  });

  // 8. Register Command: Review Due Problem
  const reviewCmd = vscode.commands.registerCommand("leetflow.review", async () => {
    const rec = await recommender.recommendNext();
    await startProblemSession(rec.slug, context, tracksProvider);
  });

  context.subscriptions.push(nextCmd, startCmd, testCmd, submitCmd, statsCmd, reviewCmd);
}

async function startProblemSession(
  slug: string,
  _context: vscode.ExtensionContext,
  tracksProvider?: LeetFlowTracksProvider,
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
        currentProblem = problem;
        firstRunTime = 0;

        const homeDir = os.homedir();
        const wsDir = path.join(homeDir, ".leetflow", "workspace", `${problem.id}-${problem.slug}`);
        fs.mkdirSync(wsDir, { recursive: true });

        const solutionPath = path.join(wsDir, "solution.py");
        const testsPath = path.join(wsDir, "tests.json");

        if (!fs.existsSync(solutionPath)) {
          fs.writeFileSync(solutionPath, problem.starterCode, "utf-8");
        }
        fs.writeFileSync(testsPath, JSON.stringify(problem.testCases, null, 2), "utf-8");

        const doc = await vscode.workspace.openTextDocument(solutionPath);
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        LeetFlowWebview.show(problem, vscode.ViewColumn.Beside);

        startTimer(problem.title);
        if (tracksProvider) tracksProvider.refresh();

        vscode.window.showInformationMessage(
          `Started #${problem.id} ${problem.title}. Press Run Tests in editor title bar when ready!`,
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to load problem: ${err.message}`);
      }
    },
  );
}

function startTimer(title: string) {
  stopTimer();
  sessionStartTime = Date.now();
  statusBarItem.show();

  timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - sessionStartTime) / 1000);
    const m = Math.floor(elapsedSec / 60);
    const s = elapsedSec % 60;
    statusBarItem.text = `$(pulse) LeetFlow: ⏱ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} | ${title}`;
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

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { LeetCodeProvider, BLIND_75_SEED } from "./providers/leetcode";
import { PythonRunner } from "./runners/python-runner";
import { LeetFlowWebview } from "./views/webview";
import { LeetFlowTracksProvider } from "./views/treeview";
import { MetricsEngine } from "./core/metrics";
import { Problem } from "./types";

let currentProblem: Problem | undefined;
let sessionStartTime: number = 0;
let statusBarItem: vscode.StatusBarItem;
let timerInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  console.log("LeetFlow extension activated.");

  // 1. Register Sidebar TreeView
  const tracksProvider = new LeetFlowTracksProvider();
  vscode.window.registerTreeDataProvider("leetflow.tracksView", tracksProvider);

  // 2. Register Status Bar Stopwatch
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = "leetflow.stats";
  context.subscriptions.push(statusBarItem);

  // 3. Register Command: Next Recommended Problem
  const nextCmd = vscode.commands.registerCommand("leetflow.next", async () => {
    const seed = BLIND_75_SEED[Math.floor(Math.random() * BLIND_75_SEED.length)];
    await startProblemSession(seed.slug, context);
  });

  // 4. Register Command: Start Specific Problem
  const startCmd = vscode.commands.registerCommand("leetflow.startProblem", async (slug: string) => {
    await startProblemSession(slug, context);
  });

  // 5. Register Command: Run Tests
  const testCmd = vscode.commands.registerCommand("leetflow.test", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !currentProblem) {
      vscode.window.showWarningMessage("No active LeetFlow problem session open.");
      return;
    }

    const doc = editor.document;
    if (!doc.fileName.endsWith(".py")) {
      vscode.window.showWarningMessage("Active file is not a Python solution file.");
      return;
    }

    await doc.save();

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "LeetFlow: Running Test Cases...",
        cancellable: false,
      },
      async () => {
        const result = await PythonRunner.runTests(
          doc.fileName,
          currentProblem!.functionName,
          currentProblem!.testCases
        );

        LeetFlowWebview.updateTestResults(result);

        if (result.allPassed) {
          vscode.window.showInformationMessage(
            `✔ All ${result.passedCount} Test Cases Passed in ${result.totalDurationMs}ms!`
          );
        } else {
          vscode.window.showErrorMessage(
            `✘ Test Failed: ${result.passedCount}/${result.totalCount} passed. Check Webview panel for details.`
          );
        }
      }
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

    const result = await PythonRunner.runTests(
      editor.document.fileName,
      currentProblem.functionName,
      currentProblem.testCases
    );

    LeetFlowWebview.updateTestResults(result);

    if (!result.allPassed) {
      vscode.window.showErrorMessage(
        "Cannot submit: Not all test cases passed. Run tests and verify edge cases first."
      );
      return;
    }

    const durationSec = Math.round((Date.now() - sessionStartTime) / 1000);
    const durationMin = Math.round(durationSec / 60);

    const frictionChoice = await vscode.window.showQuickPick(
      [
        { label: "1 - Trivial", description: "Solved effortlessly on autopilot", value: 1 },
        { label: "2 - Smooth", description: "Solved with solid understanding", value: 2 },
        { label: "3 - Struggled", description: "Needed extensive debugging or trial-and-error", value: 3 },
        { label: "4 - Looked at Solution", description: "Could not solve without looking up answer", value: 4 },
      ],
      {
        title: `LeetFlow: Rate Cognitive Friction for #${currentProblem.id} ${currentProblem.title}`,
        placeHolder: "How did the solve feel?",
      }
    );

    const ratingVal = (frictionChoice?.value || 2) as 1 | 2 | 3 | 4;
    const currentElo = context.globalState.get<number>(`elo_${currentProblem.topics[0]}`, 1400);

    const { newElo, delta } = MetricsEngine.calculateElo(
      currentElo,
      currentProblem.targetTimeSeconds > 2000 ? 1900 : currentProblem.targetTimeSeconds > 1000 ? 1600 : 1200,
      durationSec,
      currentProblem.targetTimeSeconds,
      true
    );

    const { nextIntervalDays } = MetricsEngine.calculateSM2(ratingVal, 1, 1);

    await context.globalState.update(`elo_${currentProblem.topics[0]}`, newElo);

    stopTimer();

    vscode.window.showInformationMessage(
      `🎉 Problem Solved in ${durationMin}m! Topic Elo: ${newElo} (${delta >= 0 ? "+" : ""}${delta}). Next review scheduled in ${nextIntervalDays} days.`
    );
  });

  // 7. Register Command: View Stats
  const statsCmd = vscode.commands.registerCommand("leetflow.stats", () => {
    vscode.window.showInformationMessage(
      "LeetFlow Telemetry: Steady practice! Check Sidebar for topic mastery breakdown."
    );
  });

  context.subscriptions.push(nextCmd, startCmd, testCmd, submitCmd, statsCmd);
}

async function startProblemSession(slug: string, context: vscode.ExtensionContext) {
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

        vscode.window.showInformationMessage(
          `Started #${problem.id} ${problem.title}. Press Run Tests in editor title bar when ready!`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to load problem: ${err.message}`);
      }
    }
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

import * as vscode from "vscode";
import type { Problem, TestResult } from "../types";

export class LeetFlowWebview {
  public static currentPanel: LeetFlowWebview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private problem: Problem;
  private testResult?: TestResult;

  private constructor(panel: vscode.WebviewPanel, problem: Problem) {
    this.panel = panel;
    this.problem = problem;
    this.update();

    this.panel.onDidDispose(() => {
      LeetFlowWebview.currentPanel = undefined;
    });
  }

  public static show(problem: Problem, viewColumn: vscode.ViewColumn = vscode.ViewColumn.Beside) {
    if (LeetFlowWebview.currentPanel) {
      LeetFlowWebview.currentPanel.problem = problem;
      LeetFlowWebview.currentPanel.testResult = undefined;
      LeetFlowWebview.currentPanel.panel.reveal(viewColumn);
      LeetFlowWebview.currentPanel.update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetflowProblem",
      `LeetFlow: #${problem.id} ${problem.title}`,
      viewColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    LeetFlowWebview.currentPanel = new LeetFlowWebview(panel, problem);
  }

  public static updateTestResults(result: TestResult) {
    if (LeetFlowWebview.currentPanel) {
      LeetFlowWebview.currentPanel.testResult = result;
      LeetFlowWebview.currentPanel.update();
    }
  }

  private update() {
    this.panel.title = `#${this.problem.id} ${this.problem.title}`;
    this.panel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    const p = this.problem;
    const diffColor =
      p.difficulty === "Easy" ? "#49c277" : p.difficulty === "Medium" ? "#ffc01e" : "#ff375f";

    let testResultsHtml = "";
    if (this.testResult) {
      const res = this.testResult;
      const statusBadge = res.allPassed
        ? `<div class="badge pass">✔ All ${res.totalCount} Test Cases Passed (${res.totalDurationMs}ms)</div>`
        : `<div class="badge fail">✘ ${res.passedCount}/${res.totalCount} Passed (${res.totalDurationMs}ms)</div>`;

      let casesList = "";
      if (res.caseResults && res.caseResults.length > 0) {
        casesList = res.caseResults
          .map(
            (c) => `
          <div class="case-item ${c.passed ? "case-pass" : "case-fail"}">
            <div class="case-header">
              <span><strong>Case ${c.id}:</strong> ${c.passed ? "✔ Passed" : "✘ Failed"}</span>
              <span>${c.durationMs}ms</span>
            </div>
            <div class="case-body">
              <div><strong>Input:</strong> <code>${JSON.stringify(c.input)}</code></div>
              <div><strong>Expected:</strong> <code>${JSON.stringify(c.expected)}</code></div>
              <div><strong>Actual:</strong> <code>${JSON.stringify(c.actual)}</code></div>
              ${c.error ? `<div class="error-text"><strong>Error:</strong> ${c.error}</div>` : ""}
            </div>
          </div>
        `,
          )
          .join("");
      } else if (res.error) {
        casesList = `<div class="error-box">${res.error}</div>`;
      }

      testResultsHtml = `
        <div class="test-section">
          <h3>Test Execution Results</h3>
          ${statusBadge}
          <div class="cases-container">${casesList}</div>
        </div>
      `;
    }

    const hintsHtml =
      p.hints && p.hints.length > 0
        ? `
      <details class="hints-box">
        <summary><strong>💡 Progressive Hints (${p.hints.length})</strong></summary>
        <ol>
          ${p.hints.map((h) => `<li>${h}</li>`).join("")}
        </ol>
      </details>
    `
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 16px 20px;
      line-height: 1.6;
    }
    .header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .difficulty {
      color: ${diffColor};
      font-weight: bold;
      font-size: 0.9em;
      border: 1px solid ${diffColor};
      padding: 2px 8px;
      border-radius: 12px;
    }
    .topics {
      margin-top: 8px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .topic-tag {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-size: 0.8em;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .content {
      margin-top: 16px;
    }
    pre {
      background: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
    }
    .badge {
      padding: 8px 12px;
      border-radius: 6px;
      font-weight: bold;
      margin: 10px 0;
    }
    .badge.pass { background: rgba(73, 194, 119, 0.2); color: #49c277; }
    .badge.fail { background: rgba(255, 55, 95, 0.2); color: #ff375f; }
    .case-item {
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.05));
      border: 1px solid var(--vscode-widget-border, transparent);
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 8px;
    }
    .case-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .case-pass { border-left: 4px solid #49c277; }
    .case-fail { border-left: 4px solid #ff375f; }
    .error-text { color: #ff375f; margin-top: 4px; }
    .error-box { background: rgba(255,55,95,0.15); color: #ff375f; padding: 10px; border-radius: 6px; }
    .hints-box { margin-top: 20px; padding: 8px; border: 1px dashed var(--vscode-panel-border); border-radius: 6px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-row">
      <h2>#${p.id} ${p.title}</h2>
      <span class="difficulty">${p.difficulty}</span>
    </div>
    <div class="topics">
      ${p.topics.map((t) => `<span class="topic-tag">${t}</span>`).join("")}
      <span class="topic-tag">⏱ Target: ${Math.round(p.targetTimeSeconds / 60)}m</span>
    </div>
  </div>

  ${testResultsHtml}

  <div class="content">
    ${p.descriptionHtml}
  </div>

  ${hintsHtml}
</body>
</html>`;
  }
}

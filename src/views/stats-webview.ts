import * as vscode from "vscode";
import type { StorageManager } from "../storage/storage-manager";
import { StatsCalculator, type SummaryStats } from "./stats-calculator";

export class LeetFlowStatsWebview {
  public static currentPanel: LeetFlowStatsWebview | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private storage: StorageManager,
  ) {
    this._panel = panel;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
  }

  public static show(storage: StorageManager) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (LeetFlowStatsWebview.currentPanel) {
      LeetFlowStatsWebview.currentPanel._panel.reveal(column);
      LeetFlowStatsWebview.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetflow.statsWebview",
      "LeetFlow Proficiency & Telemetry",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    LeetFlowStatsWebview.currentPanel = new LeetFlowStatsWebview(panel, storage);
  }

  private async _update() {
    const stats = await StatsCalculator.computeSummary(this.storage);
    this._panel.webview.html = this._getHtmlForWebview(stats);
  }

  public dispose() {
    LeetFlowStatsWebview.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _getHtmlForWebview(stats: SummaryStats): string {
    const blind75Percent =
      stats.blind75Total > 0 ? Math.round((stats.blind75Solved / stats.blind75Total) * 100) : 0;

    const topicRows = stats.topicMasteries
      .map(
        (m) => `
      <tr>
        <td><strong>${m.topic}</strong></td>
        <td><span class="badge badge-elo">${m.elo}</span></td>
        <td>${m.solvedCount}</td>
        <td>${m.reviewIntervalDays}d</td>
        <td>${m.nextReviewDue ? new Date(m.nextReviewDue).toLocaleDateString() : "None"}</td>
      </tr>
    `,
      )
      .join("");

    const reviewAlert =
      stats.dueReviews.length > 0
        ? `<div class="alert alert-warning">
          <strong>⚠️ ${stats.dueReviews.length} Topic(s) Overdue for Spaced Review:</strong>
          ${stats.dueReviews.map((r) => `${r.topic} (${r.daysOverdue}d overdue)`).join(", ")}
        </div>`
        : `<div class="alert alert-success">✔ All spaced reviews are up to date!</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeetFlow Telemetry</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --border: var(--vscode-panel-border, #333);
      --accent: #007acc;
      --success: #388a34;
      --warning: #cca700;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding: 24px;
      margin: 0;
      line-height: 1.5;
    }
    h1 { font-size: 22px; margin-bottom: 20px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 28px;
      font-weight: 700;
    }
    .card-subtext {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .alert {
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .alert-success { background: rgba(56, 138, 52, 0.2); border: 1px solid var(--success); color: #7ee787; }
    .alert-warning { background: rgba(204, 167, 0, 0.2); border: 1px solid var(--warning); color: #f2cc60; }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border-radius: 8px;
      overflow: hidden;
      font-size: 13px;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: rgba(255,255,255,0.05);
      font-weight: 600;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-elo { background: rgba(0, 122, 204, 0.2); color: #79c0ff; }
  </style>
</head>
<body>
  <h1>📊 LeetFlow Proficiency & Telemetry Dashboard</h1>
  ${reviewAlert}
  <div class="grid">
    <div class="card">
      <div class="card-title">Total Solved Problems</div>
      <div class="card-value" style="color: #58a6ff;">${stats.totalSolved}</div>
      <div class="card-subtext">Unique problems completed</div>
    </div>
    <div class="card">
      <div class="card-title">Blind 75 Roadmap</div>
      <div class="card-value" style="color: #7ee787;">${stats.blind75Solved}/${stats.blind75Total}</div>
      <div class="card-subtext">Progress: ${blind75Percent}%</div>
    </div>
    <div class="card">
      <div class="card-title">Zero-Shot Accuracy</div>
      <div class="card-value" style="color: #d2a8ff;">${stats.zeroShotRate}%</div>
      <div class="card-subtext">Passed on 1st test run</div>
    </div>
    <div class="card">
      <div class="card-title">Average Solve Duration</div>
      <div class="card-value" style="color: #ffa657;">${stats.avgDurationMinutes}m</div>
      <div class="card-subtext">Time spent per problem</div>
    </div>
  </div>

  <h2 style="font-size: 16px; margin: 24px 0 12px 0;">🎯 Topic Mastery & Elo Ratings</h2>
  ${
    stats.topicMasteries.length > 0
      ? `<table>
      <thead>
        <tr>
          <th>Topic Category</th>
          <th>Current Elo</th>
          <th>Solved Count</th>
          <th>SM-2 Interval</th>
          <th>Next Spaced Review</th>
        </tr>
      </thead>
      <tbody>
        ${topicRows}
      </tbody>
    </table>`
      : `<div class="card" style="text-align: center; padding: 24px; opacity: 0.7;">
      No problems completed yet. Start your first problem with "LeetFlow: Next"!
    </div>`
  }
</body>
</html>`;
  }
}

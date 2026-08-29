import * as vscode from "vscode";
import type { StorageManager } from "../storage/storage-manager";
import { StatsCalculator, type SummaryStats } from "./stats-calculator";

export class LeetFlowStatsWebview {
  public static currentPanel: LeetFlowStatsWebview | undefined;
  private readonly panel: vscode.WebviewPanel;
  private stats?: SummaryStats;

  private constructor(
    panel: vscode.WebviewPanel,
    private storage: StorageManager,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      LeetFlowStatsWebview.currentPanel = undefined;
    });
    this.refresh();
  }

  public static show(
    storage: StorageManager,
    viewColumn: vscode.ViewColumn = vscode.ViewColumn.One,
  ) {
    if (LeetFlowStatsWebview.currentPanel) {
      LeetFlowStatsWebview.currentPanel.panel.reveal(viewColumn);
      LeetFlowStatsWebview.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetflowStats",
      "LeetFlow: Mastery & Performance Telemetry",
      viewColumn,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    LeetFlowStatsWebview.currentPanel = new LeetFlowStatsWebview(panel, storage);
  }

  public async refresh() {
    this.stats = await StatsCalculator.computeSummary(this.storage);
    this.panel.webview.html = this.getHtml();
  }

  private getHtml(): string {
    if (!this.stats) {
      return "<h3>Loading metrics...</h3>";
    }

    const s = this.stats;
    const b75Pct = s.blind75Total > 0 ? Math.round((s.blind75Solved / s.blind75Total) * 100) : 0;

    const topicRows = s.topicMasteries
      .map(
        (m) => `
      <tr>
        <td><strong>${m.topic}</strong></td>
        <td><span class="badge elo">${m.elo}</span></td>
        <td>${m.solvedCount} Solved</td>
        <td>${m.reviewIntervalDays > 0 ? `${m.reviewIntervalDays} days` : "Just started"}</td>
        <td>${m.nextReviewDue ? new Date(m.nextReviewDue).toLocaleDateString() : "-"}</td>
      </tr>
    `,
      )
      .join("");

    const reviewAlert =
      s.dueReviews.length > 0
        ? `<div class="alert-box">
          <h4>⏰ ${s.dueReviews.length} Topic(s) Due for Spaced Review</h4>
          <ul>${s.dueReviews.map((r) => `<li><strong>${r.topic}</strong> (${r.daysOverdue} days overdue)</li>`).join("")}</ul>
        </div>`
        : `<div class="alert-box clean">✔ All spaced reviews are up to date!</div>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: var(--vscode-font-family, sans-serif);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px 32px;
      line-height: 1.5;
    }
    .header {
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .metric-card {
      background: var(--vscode-editorWidget-background, rgba(255,255,255,0.05));
      border: 1px solid var(--vscode-widget-border, rgba(255,255,255,0.1));
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-value {
      font-size: 2.2em;
      font-weight: bold;
      color: #49c277;
    }
    .metric-label {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
      margin-top: 4px;
    }
    .progress-bar {
      height: 10px;
      background: rgba(255,255,255,0.1);
      border-radius: 5px;
      overflow: hidden;
      margin-top: 8px;
    }
    .progress-fill {
      height: 100%;
      background: #007acc;
      border-radius: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      background: rgba(255,255,255,0.03);
      color: var(--vscode-descriptionForeground);
    }
    .badge.elo {
      background: rgba(255, 192, 30, 0.2);
      color: #ffc01e;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: bold;
    }
    .alert-box {
      background: rgba(255, 192, 30, 0.15);
      border: 1px solid #ffc01e;
      border-radius: 6px;
      padding: 12px 16px;
      margin-bottom: 24px;
    }
    .alert-box.clean {
      background: rgba(73, 194, 119, 0.15);
      border-color: #49c277;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>📊 LeetFlow: Proficiency & Telemetry Dashboard</h2>
  </div>

  ${reviewAlert}

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-value">${s.totalSolved}</div>
      <div class="metric-label">Total Solved Problems</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.zeroShotRate}%</div>
      <div class="metric-label">Zero-Shot Accuracy (1st Pass)</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.avgDurationMinutes}m</div>
      <div class="metric-label">Average Solve Duration</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${s.blind75Solved}/${s.blind75Total}</div>
      <div class="metric-label">Blind 75 (${b75Pct}%)</div>
      <div class="progress-bar"><div class="progress-fill" style="width: ${b75Pct}%"></div></div>
    </div>
  </div>

  <h3>🎯 Topic Mastery & Elo Ratings</h3>
  <table>
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
      ${topicRows || `<tr><td colspan="5">No problems completed yet. Start your first problem with "LeetFlow: Next"!</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
  }
}

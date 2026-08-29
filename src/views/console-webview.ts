import * as fs from "node:fs";
import * as vscode from "vscode";
import type { StorageManager } from "../storage/storage-manager";
import { StatsCalculator, type SummaryStats } from "./stats-calculator";

export class LeetFlowConsoleWebview {
  public static currentPanel: LeetFlowConsoleWebview | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private storage: StorageManager,
    private onDataChanged?: () => void,
  ) {
    this._panel = panel;
    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "resetHistory": {
            const confirm = await vscode.window.showWarningMessage(
              "Are you sure you want to reset all LeetFlow practice history, attempts, and Elo ratings?",
              { modal: true },
              "Yes, Reset All Data",
            );
            if (confirm === "Yes, Reset All Data") {
              await this.storage.resetAll();
              if (this.onDataChanged) this.onDataChanged();
              await this._update();
              vscode.window.showInformationMessage(
                "✔ All LeetFlow history and telemetry data has been wiped.",
              );
            }
            break;
          }
          case "exportData": {
            const json = await this.storage.exportAllData();
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file("leetflow-backup.json"),
              filters: { "JSON Files": ["json"] },
              title: "Export LeetFlow Practice History & Telemetry",
            });
            if (uri) {
              fs.writeFileSync(uri.fsPath, json, "utf-8");
              vscode.window.showInformationMessage(`✔ Exported practice backup to ${uri.fsPath}`);
            }
            break;
          }
          case "importData": {
            const uris = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters: { "JSON Files": ["json"] },
              title: "Import LeetFlow Practice History",
            });
            if (uris && uris.length > 0) {
              const content = fs.readFileSync(uris[0].fsPath, "utf-8");
              const success = await this.storage.importData(content);
              if (success) {
                if (this.onDataChanged) this.onDataChanged();
                await this._update();
                vscode.window.showInformationMessage(
                  "✔ Successfully restored practice history from backup!",
                );
              } else {
                vscode.window.showErrorMessage(
                  "Failed to import: Invalid or corrupted backup JSON file.",
                );
              }
            }
            break;
          }
          case "purgeWorkspace": {
            const { deletedCount } = await this.storage.purgeWorkspace();
            vscode.window.showInformationMessage(
              `✔ Cleaned ${deletedCount} solution directories in ~/.leetflow/workspace`,
            );
            break;
          }
          case "startProblem": {
            if (message.slug) {
              vscode.commands.executeCommand("leetflow.startProblem", message.slug);
            }
            break;
          }
        }
      },
      null,
      this._disposables,
    );
  }

  public static show(storage: StorageManager, onDataChanged?: () => void) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (LeetFlowConsoleWebview.currentPanel) {
      LeetFlowConsoleWebview.currentPanel._panel.reveal(column);
      LeetFlowConsoleWebview.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetflow.consoleWebview",
      "LeetFlow Console & Control Center",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    LeetFlowConsoleWebview.currentPanel = new LeetFlowConsoleWebview(panel, storage, onDataChanged);
  }

  private async _update() {
    const stats = await StatsCalculator.computeSummary(this.storage);
    this._panel.webview.html = this._getHtmlForWebview(stats);
  }

  public dispose() {
    LeetFlowConsoleWebview.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _getHtmlForWebview(stats: SummaryStats): string {
    const blind75Percent =
      stats.blind75Total > 0 ? Math.round((stats.blind75Solved / stats.blind75Total) * 100) : 0;
    const _neetCodePercent =
      stats.neetCodeTotal > 0 ? Math.round((stats.neetCodeSolved / stats.neetCodeTotal) * 100) : 0;

    const masteryRows = stats.topicMasteries
      .map((m) => {
        const eloWidth = Math.min(100, Math.max(10, Math.round(((m.elo - 1000) / 1000) * 100)));
        return `
        <div class="mastery-item">
          <div class="mastery-header">
            <span class="topic-name">${m.topic}</span>
            <span class="elo-badge">${m.elo} Elo (${m.solvedCount} solved)</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${eloWidth}%;"></div>
          </div>
        </div>
      `;
      })
      .join("");

    const attemptRows = stats.attempts
      .map((a, idx) => {
        const dateStr = new Date(a.timestamp).toLocaleString();
        const frictionLabels: Record<number, string> = {
          1: "Trivial",
          2: "Smooth",
          3: "Struggled",
          4: "Solution",
        };
        const frictionClass = `f-${a.frictionRating}`;
        const durMin = Math.round((a.durationSec / 60) * 10) / 10;
        const thinkSec = a.thinkingSec;

        return `
        <tr>
          <td>#${idx + 1}</td>
          <td>
            <a href="#" class="problem-link" onclick="startProblem('${a.slug}')">
              #${a.problemId} ${a.slug}
            </a>
          </td>
          <td><span class="tag">${a.topic}</span></td>
          <td>${durMin}m <span class="subtext">(${thinkSec}s think)</span></td>
          <td><span class="badge ${frictionClass}">${frictionLabels[a.frictionRating] || "Smooth"}</span></td>
          <td>${a.zeroShot ? "⚡ Zero-Shot" : "Standard"}</td>
          <td class="date-col">${dateStr}</td>
        </tr>
      `;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeetFlow Console</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #d4d4d4);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --border: var(--vscode-panel-border, #333);
      --accent: #007acc;
      --accent-hover: #0062a3;
      --success: #388a34;
      --warning: #cca700;
      --danger: #e51400;
      --danger-hover: #b81000;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--fg);
      padding: 24px;
      margin: 0;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }
    .tab-btn {
      background: var(--card-bg);
      color: var(--fg);
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .tab-btn.active {
      background: var(--accent);
      color: white;
      border-color: var(--accent);
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 26px;
      font-weight: 700;
    }
    .card-subtext {
      font-size: 12px;
      opacity: 0.8;
      margin-top: 4px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 20px 0 12px 0;
    }
    .mastery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 12px;
    }
    .mastery-item {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
    }
    .mastery-header {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .elo-badge {
      color: #e5a00d;
    }
    .progress-bar {
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border-radius: 8px;
      overflow: hidden;
      font-size: 13px;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      background: rgba(255,255,255,0.05);
      font-weight: 600;
    }
    .problem-link {
      color: #58a6ff;
      text-decoration: none;
      font-weight: 500;
      cursor: pointer;
    }
    .problem-link:hover {
      text-decoration: underline;
    }
    .tag {
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .f-1 { background: rgba(56, 138, 52, 0.25); color: #7ee787; }
    .f-2 { background: rgba(0, 122, 204, 0.25); color: #79c0ff; }
    .f-3 { background: rgba(204, 167, 0, 0.25); color: #e3b341; }
    .f-4 { background: rgba(229, 20, 0, 0.25); color: #ff7b72; }
    .btn {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: var(--danger-hover); }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: var(--fg);
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .danger-zone {
      border: 1px solid rgba(229, 20, 0, 0.4);
      background: rgba(229, 20, 0, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin-top: 20px;
    }
    .danger-header {
      color: #ff7b72;
      font-weight: 700;
      font-size: 15px;
      margin-bottom: 8px;
    }
    .danger-desc {
      font-size: 13px;
      opacity: 0.8;
      margin-bottom: 16px;
    }
    .action-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .subtext {
      font-size: 11px;
      opacity: 0.6;
    }
    .date-col {
      font-size: 12px;
      opacity: 0.7;
    }
    .empty-state {
      padding: 30px;
      text-align: center;
      opacity: 0.6;
    }
  </style>
</head>
<body>

  <div class="header">
    <h1>🐻 LeetFlow Console & Control Center</h1>
    <div class="action-row">
      <button class="btn btn-secondary" onclick="exportData()">💾 Export Backup</button>
      <button class="btn btn-secondary" onclick="importData()">📥 Import Backup</button>
    </div>
  </div>

  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('analytics')">📊 Telemetry & Mastery</button>
    <button class="tab-btn" onclick="switchTab('history')">📜 Attempt History (${stats.attempts.length})</button>
    <button class="tab-btn" onclick="switchTab('danger')">⚙️ Data Management</button>
  </div>

  <!-- TAB 1: ANALYTICS -->
  <div id="tab-analytics" class="tab-content active">
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Solved</div>
        <div class="card-value">${stats.totalSolved}</div>
        <div class="card-subtext">Unique problems completed</div>
      </div>
      <div class="card">
        <div class="card-title">Blind 75 Roadmap</div>
        <div class="card-value">${stats.blind75Solved} / ${stats.blind75Total}</div>
        <div class="card-subtext">${blind75Percent}% completed</div>
      </div>
      <div class="card">
        <div class="card-title">Zero-Shot Pass Rate</div>
        <div class="card-value">${stats.zeroShotRate}%</div>
        <div class="card-subtext">Solved on first test run</div>
      </div>
      <div class="card">
        <div class="card-title">Average Duration</div>
        <div class="card-value">${stats.avgDurationMinutes}m</div>
        <div class="card-subtext">Solve pace per problem</div>
      </div>
    </div>

    <div class="section-title">Cognitive Friction Distribution</div>
    <div class="grid">
      <div class="card" style="border-left: 4px solid #7ee787;">
        <div class="card-title">1 - Trivial</div>
        <div class="card-value">${stats.frictionBreakdown.trivial}</div>
        <div class="card-subtext">Autopilot solves</div>
      </div>
      <div class="card" style="border-left: 4px solid #79c0ff;">
        <div class="card-title">2 - Smooth</div>
        <div class="card-value">${stats.frictionBreakdown.smooth}</div>
        <div class="card-subtext">Solid understanding</div>
      </div>
      <div class="card" style="border-left: 4px solid #e3b341;">
        <div class="card-title">3 - Struggled</div>
        <div class="card-value">${stats.frictionBreakdown.struggled}</div>
        <div class="card-subtext">Extensive debugging</div>
      </div>
      <div class="card" style="border-left: 4px solid #ff7b72;">
        <div class="card-title">4 - Solution</div>
        <div class="card-value">${stats.frictionBreakdown.looked}</div>
        <div class="card-subtext">Looked up answer</div>
      </div>
    </div>

    <div class="section-title">Topic Mastery & Skill Ratings</div>
    <div class="mastery-grid">
      ${masteryRows || "<div class='empty-state'>No topic mastery recorded yet. Start solving problems to calibrate your Elo!</div>"}
    </div>
  </div>

  <!-- TAB 2: ATTEMPT HISTORY -->
  <div id="tab-history" class="tab-content">
    <div class="section-title">Chronological Solve Sessions</div>
    ${
      stats.attempts.length > 0
        ? `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Problem</th>
            <th>Topic</th>
            <th>Duration</th>
            <th>Friction</th>
            <th>Mode</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          ${attemptRows}
        </tbody>
      </table>
    `
        : `
      <div class="card empty-state">
        No solve sessions recorded yet. Complete a problem session to populate your history!
      </div>
    `
    }
  </div>

  <!-- TAB 3: DATA MANAGEMENT -->
  <div id="tab-danger" class="tab-content">
    <div class="card" style="margin-bottom: 20px;">
      <div class="section-title" style="margin-top: 0;">Backup & Portable Storage</div>
      <p style="font-size: 13px; opacity: 0.8;">Export your attempt history and topic ratings to a JSON file to transfer between machines or backup your progress.</p>
      <div class="action-row">
        <button class="btn btn-secondary" onclick="exportData()">💾 Export History to JSON</button>
        <button class="btn btn-secondary" onclick="importData()">📥 Restore from Backup JSON</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="section-title" style="margin-top: 0;">Workspace Cache Cleanup</div>
      <p style="font-size: 13px; opacity: 0.8;">Purge temporary cached problem folders in <code>~/.leetflow/workspace</code> to save disk space without losing your solve telemetry.</p>
      <button class="btn btn-secondary" onclick="purgeWorkspace()">🧹 Purge Workspace Cache</button>
    </div>

    <div class="danger-zone">
      <div class="danger-header">⚠️ Danger Zone: Reset Practice Progress</div>
      <div class="danger-desc">Permanently wipe all problem attempts, zero-shot rates, and topic Elo ratings back to default baseline (1200 Elo). This action cannot be undone unless you have exported a JSON backup.</div>
      <button class="btn btn-danger" onclick="resetHistory()">🔥 Reset All History & Telemetry</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      const targetBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.toLowerCase().includes(tabId));
      if (targetBtn) targetBtn.classList.add('active');
      
      const targetContent = document.getElementById('tab-' + tabId);
      if (targetContent) targetContent.classList.add('active');
    }

    function resetHistory() {
      vscode.postMessage({ command: "resetHistory" });
    }

    function exportData() {
      vscode.postMessage({ command: "exportData" });
    }

    function importData() {
      vscode.postMessage({ command: "importData" });
    }

    function purgeWorkspace() {
      vscode.postMessage({ command: "purgeWorkspace" });
    }

    function startProblem(slug) {
      vscode.postMessage({ command: "startProblem", slug });
    }
  </script>
</body>
</html>
`;
  }
}

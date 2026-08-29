import * as vscode from "vscode";
import type { StorageManager } from "../storage/storage-manager";
import type { TopicRadarMetric } from "../types";
import { StatsCalculator, type SummaryStats } from "./stats-calculator";

export class LeetFlowConsoleWebview {
  public static currentPanel: LeetFlowConsoleWebview | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private storage: StorageManager,
    private onDataMutated?: () => void,
  ) {
    this._panel = panel;
    this._panel.webview.options = {
      enableScripts: true,
    };

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "exportData": {
            const json = await this.storage.exportAllData();
            const uri = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file("leetflow-backup.json"),
              filters: { "JSON Files": ["json"] },
            });
            if (uri) {
              const encoder = new TextEncoder();
              await vscode.workspace.fs.writeFile(uri, encoder.encode(json));
              vscode.window.showInformationMessage(
                "LeetFlow telemetry backup exported successfully!",
              );
            }
            break;
          }
          case "importData": {
            const uris = await vscode.window.showOpenDialog({
              canSelectMany: false,
              filters: { "JSON Files": ["json"] },
            });
            if (uris?.[0]) {
              const data = await vscode.workspace.fs.readFile(uris[0]);
              const content = new TextDecoder().decode(data);
              const ok = await this.storage.importData(content);
              if (ok) {
                vscode.window.showInformationMessage("LeetFlow backup restored successfully!");
                this._update();
                if (this.onDataMutated) this.onDataMutated();
              } else {
                vscode.window.showErrorMessage("Invalid LeetFlow backup JSON file.");
              }
            }
            break;
          }
          case "resetAll": {
            const answer = await vscode.window.showWarningMessage(
              "Are you sure you want to reset all LeetFlow practice history, attempts, and readiness telemetry?",
              { modal: true },
              "Yes, Reset Everything",
            );
            if (answer === "Yes, Reset Everything") {
              await this.storage.resetAll();
              vscode.window.showInformationMessage("LeetFlow telemetry reset to initial baseline.");
              this._update();
              if (this.onDataMutated) this.onDataMutated();
            }
            break;
          }
          case "purgeWorkspace": {
            const answer = await vscode.window.showWarningMessage(
              "This will delete all local solution folders in ~/.leetflow/workspace. Continue?",
              { modal: true },
              "Purge Workspace",
            );
            if (answer === "Purge Workspace") {
              const { deletedCount } = await this.storage.purgeWorkspace();
              vscode.window.showInformationMessage(`Purged ${deletedCount} solution workspaces.`);
              this._update();
            }
            break;
          }
          case "startProblem": {
            vscode.commands.executeCommand("leetflow.openProblem", message.slug);
            break;
          }
        }
      },
      null,
      this._disposables,
    );
  }

  public static show(storage: StorageManager, onDataMutated?: () => void) {
    if (LeetFlowConsoleWebview.currentPanel) {
      LeetFlowConsoleWebview.currentPanel._panel.reveal(vscode.ViewColumn.One);
      LeetFlowConsoleWebview.currentPanel._update();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "leetflowConsole",
      "LeetFlow Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      },
    );

    LeetFlowConsoleWebview.currentPanel = new LeetFlowConsoleWebview(panel, storage, onDataMutated);
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

  private _generateRadarSvg(topics: TopicRadarMetric[]): string {
    const cx = 150;
    const cy = 140;
    const maxR = 85;
    const numAxes = 6;

    const levels = [0.25, 0.5, 0.75, 1.0];
    let ringsHtml = "";
    for (const lvl of levels) {
      const pts: string[] = [];
      for (let i = 0; i < numAxes; i++) {
        const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
        const x = cx + maxR * lvl * Math.cos(angle);
        const y = cy + maxR * lvl * Math.sin(angle);
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      ringsHtml += `<polygon points="${pts.join(" ")}" fill="${lvl === 1.0 ? "rgba(56, 189, 248, 0.02)" : "none"}" stroke="currentColor" stroke-opacity="${lvl === 1.0 ? "0.22" : "0.1"}" stroke-width="1" stroke-dasharray="${lvl < 1.0 ? "2,2" : "none"}" />`;
    }

    let axisLinesHtml = "";
    for (let i = 0; i < numAxes; i++) {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const x = cx + maxR * Math.cos(angle);
      const y = cy + maxR * Math.sin(angle);
      axisLinesHtml += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.16" stroke-width="1" />`;
    }

    const polyPts: string[] = [];
    let dotsHtml = "";
    let labelsHtml = "";

    topics.forEach((t, i) => {
      const angle = (i * 2 * Math.PI) / numAxes - Math.PI / 2;
      const r = (Math.max(12, t.score) / 100) * maxR;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      polyPts.push(`${x.toFixed(1)},${y.toFixed(1)}`);

      dotsHtml += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="#38bdf8" stroke="#ffffff" stroke-width="1.2" />`;

      const labelR = maxR + 20;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);

      labelsHtml += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="currentColor" font-size="9" font-weight="600" opacity="0.9">${t.name}</text>`;
      labelsHtml += `<text x="${lx.toFixed(1)}" y="${(ly + 9.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="#38bdf8" font-size="7.5" font-weight="bold">${t.score}%</text>`;
    });

    return `
      <svg viewBox="0 0 300 280" style="width: 100%; max-width: 250px; height: auto; display: block; margin: 0 auto;">
        ${ringsHtml}
        ${axisLinesHtml}
        <polygon points="${polyPts.join(" ")}" fill="rgba(56, 189, 248, 0.22)" stroke="#38bdf8" stroke-width="2.2" stroke-linejoin="round" />
        ${dotsHtml}
        ${labelsHtml}
      </svg>
    `;
  }

  private _getHtmlForWebview(stats: SummaryStats): string {
    const radarSvg = this._generateRadarSvg(stats.radarTopics);

    const radarTopicRows = stats.radarTopics
      .map(
        (t) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #38bdf8;">
          <div>
            <div style="font-weight: 600; font-size: 12px;">${t.name}</div>
            <div style="font-size: 10px; opacity: 0.65;">${t.solvedCount} solved · ${t.smoothRate}% smooth flow</div>
          </div>
          <span style="font-weight: 700; color: #38bdf8; font-size: 13px;">${t.score}%</span>
        </div>
      `,
      )
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

        const meta = TrackRegistry.findProblemBySlug(a.slug);
        const diff: Difficulty = a.difficulty || meta?.difficulty || "Easy";
        const diffClass = `tag-${diff.toLowerCase()}`;

        return `
        <tr>
          <td>#${idx + 1}</td>
          <td>
            <a href="#" class="problem-link" onclick="startProblem('${a.slug}')">
              #${a.problemId} ${a.slug}
            </a>
          </td>
          <td><span class="tag ${diffClass}">${diff}</span></td>
          <td>${durMin}m <span class="subtext">(${thinkSec}s think)</span></td>
          <td><span class="badge ${frictionClass}">${frictionLabels[a.frictionRating] || "Smooth"}</span></td>
          <td>${a.zeroShot ? "⚡ Zero-Shot" : "Standard"}</td>
          <td><span class="subtext">${dateStr}</span></td>
        </tr>
      `;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LeetFlow Dashboard</title>
  <style>
    :root {
      --bg-color: var(--vscode-editor-background, #1e1e1e);
      --card-bg: var(--vscode-sideBar-background, #252526);
      --card-border: var(--vscode-widget-border, rgba(255, 255, 255, 0.1));
      --text-color: var(--vscode-editor-foreground, #cccccc);
      --accent-blue: #38bdf8;
      --accent-purple: #a371f7;
      --accent-green: #7ee787;
      --accent-yellow: #e3b341;
      --accent-red: #ff7b72;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      padding: 24px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--card-border);
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header .tagline {
      font-size: 12px;
      opacity: 0.7;
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--card-border);
    }
    .tab-btn {
      background: none;
      border: none;
      color: var(--text-color);
      padding: 8px 16px;
      font-size: 13px;
      cursor: pointer;
      opacity: 0.6;
      border-bottom: 2px solid transparent;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      opacity: 1;
      font-weight: 600;
      color: var(--accent-blue);
      border-bottom-color: var(--accent-blue);
    }

    .tab-content { display: none; }
    .tab-content.active { display: block; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 16px;
    }
    .card-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
    }
    .card-subtext {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      margin: 24px 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      background: var(--card-bg);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--card-border);
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--card-border);
    }
    th {
      font-weight: 600;
      opacity: 0.7;
      background: rgba(255, 255, 255, 0.02);
    }
    tr:hover {
      background: rgba(255, 255, 255, 0.02);
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .f-1 { background: rgba(126, 231, 135, 0.15); color: #7ee787; }
    .f-2 { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .f-3 { background: rgba(227, 179, 65, 0.15); color: #e3b341; }
    .f-4 { background: rgba(255, 123, 114, 0.15); color: #ff7b72; }

    .tag {
      background: rgba(255, 255, 255, 0.06);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
    }
    .tag-easy {
      background: rgba(126, 231, 135, 0.12);
      color: #7ee787;
      border: 1px solid rgba(126, 231, 135, 0.25);
    }
    .tag-medium {
      background: rgba(227, 179, 65, 0.12);
      color: #e3b341;
      border: 1px solid rgba(227, 179, 65, 0.25);
    }
    .tag-hard {
      background: rgba(255, 123, 114, 0.12);
      color: #ff7b72;
      border: 1px solid rgba(255, 123, 114, 0.25);
    }
    .subtext { font-size: 10px; opacity: 0.6; }
    .problem-link {
      color: var(--accent-blue);
      text-decoration: none;
      font-weight: 500;
    }
    .problem-link:hover {
      text-decoration: underline;
    }

    .btn {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      color: var(--text-color);
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.08);
    }
    .btn-danger {
      color: var(--accent-red);
      border-color: rgba(255, 123, 114, 0.4);
    }
    .btn-danger:hover {
      background: rgba(255, 123, 114, 0.1);
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>⚡ LeetFlow Dashboard</h1>
      <div class="tagline">Deliberate Practice Telemetry & Local Session Management</div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn" onclick="exportData()">Export Backup</button>
      <button class="btn" onclick="importData()">Restore Backup</button>
    </div>
  </div>

  <div class="tabs">
    <button class="tab-btn active" onclick="switchTab('analytics')">📊 Telemetry & Proficiency</button>
    <button class="tab-btn" onclick="switchTab('history')">📜 Attempt History (${stats.attempts.length})</button>
    <button class="tab-btn" onclick="switchTab('danger')">⚙️ Data Management</button>
  </div>

  <!-- TAB 1: ANALYTICS -->
  <div id="tab-analytics" class="tab-content active">
    <!-- Hero Card -->
    <div class="card hero-grade-card" style="margin-bottom: 20px; border-left: 6px solid #38bdf8; background: rgba(56, 189, 248, 0.06);">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="card-title" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Unified Interview Readiness</div>
          <div style="font-size: 32px; font-weight: 700; color: #fff; margin: 4px 0;">
            Grade: <span style="color: #38bdf8;">${stats.trend.grade}</span>
            <span style="font-size: 20px; font-weight: 400; color: #8b949e; margin-left: 8px;">(${stats.trend.readinessPct}% Global Readiness)</span>
          </div>
          <div class="card-subtext" style="font-size: 12px;">Calibrated continuously from problem difficulty, solve speed, and recall friction</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px;">🔥 ${stats.trend.streakDays} Day Streak</div>
          <div class="card-subtext">${stats.trend.solvedLast7Days} solved past 7 days</div>
        </div>
      </div>
    </div>

    <!-- 4 Metrics Row -->
    <div class="grid">
      <div class="card">
        <div class="card-title">Total Solved</div>
        <div class="card-value">${stats.totalSolved}</div>
        <div class="card-subtext">${stats.activeTrackName}: ${stats.activeTrackSolved}/${stats.activeTrackTotal}</div>
      </div>
      <div class="card">
        <div class="card-title">7-Day Velocity</div>
        <div class="card-value">${stats.trend.solvedLast7Days}</div>
        <div class="card-subtext">${stats.trend.solvedLast30Days} solved past 30 days</div>
      </div>
      <div class="card">
        <div class="card-title">Cognitive Flow Rate</div>
        <div class="card-value">${stats.trend.smoothRatePct}%</div>
        <div class="card-subtext">Solved with zero/low friction</div>
      </div>
      <div class="card">
        <div class="card-title">Average Duration</div>
        <div class="card-value">${stats.avgDurationMinutes}m</div>
        <div class="card-subtext">Zero-Shot Rate: ${stats.zeroShotRate}%</div>
      </div>
    </div>

    <!-- RADAR CHART SECTION -->
    <div class="section-title">🕸 Top 6 LeetCode Topic Composition & Performance Radar</div>
    <div class="card" style="margin-bottom: 24px; padding: 20px;">
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; align-items: center;">
        <div style="text-align: center;">
          ${radarSvg}
        </div>
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.7; margin-bottom: 10px;">
            Active Top Domains
          </div>
          ${radarTopicRows}
        </div>
      </div>
    </div>

    <!-- Difficulty & Review Health -->
    <div class="section-title">Difficulty Distribution & Review Health</div>
    <div class="grid">
      <div class="card" style="border-left: 4px solid #7ee787;">
        <div class="card-title">🟢 Easy Problems</div>
        <div class="card-value">${stats.trend.easySolved}</div>
        <div class="card-subtext">Foundations solid</div>
      </div>
      <div class="card" style="border-left: 4px solid #e3b341;">
        <div class="card-title">🟡 Medium Problems</div>
        <div class="card-value">${stats.trend.mediumSolved}</div>
        <div class="card-subtext">Core interview standard</div>
      </div>
      <div class="card" style="border-left: 4px solid #ff7b72;">
        <div class="card-title">🔴 Hard Problems</div>
        <div class="card-value">${stats.trend.hardSolved}</div>
        <div class="card-subtext">Advanced edge patterns</div>
      </div>
      <div class="card" style="border-left: 4px solid #38bdf8;">
        <div class="card-title">⏱ Due SM-2 Reviews</div>
        <div class="card-value">${stats.dueReviewsCount}</div>
        <div class="card-subtext">Scheduled for spaced recall</div>
      </div>
    </div>

    <!-- Cognitive Friction Breakdown -->
    <div class="section-title">Cognitive Friction Distribution</div>
    <div class="grid">
      <div class="card" style="border-left: 4px solid #7ee787;">
        <div class="card-title">1 - Trivial</div>
        <div class="card-value">${stats.frictionBreakdown.trivial}</div>
        <div class="card-subtext">Autopilot solves</div>
      </div>
      <div class="card" style="border-left: 4px solid #38bdf8;">
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
            <th>Difficulty</th>
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
    <div class="section-title">Data Sovereignty & Local Workspaces</div>
    
    <div class="card" style="margin-bottom: 16px;">
      <div class="card-title">JSON Telemetry Backup & Restore</div>
      <div class="card-subtext" style="margin-bottom: 12px;">Export all problem solve history and readiness stats to a portable JSON file, or restore from a previous backup.</div>
      <div style="display: flex; gap: 8px;">
        <button class="btn" onclick="exportData()">Export Backup (.json)</button>
        <button class="btn" onclick="importData()">Import & Restore (.json)</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 16px;">
      <div class="card-title">Purge Solution Workspace Directory</div>
      <div class="card-subtext" style="margin-bottom: 12px;">Deletes cached scratch directories in ~/.leetflow/workspace to free local disk space while preserving all metrics.</div>
      <button class="btn btn-danger" onclick="purgeWorkspace()">Purge ~/.leetflow/workspace</button>
    </div>

    <div class="card">
      <div class="card-title">Reset All LeetFlow Telemetry</div>
      <div class="card-subtext" style="margin-bottom: 12px;">Permanently wipe all problem attempts, zero-shot rates, and readiness score back to 0%. This action cannot be undone unless you have exported a JSON backup.</div>
      <button class="btn btn-danger" onclick="resetAll()">Reset All Telemetry & Attempts</button>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function switchTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      event.target.classList.add('active');
      document.getElementById('tab-' + tabId).classList.add('active');
    }

    function exportData() { vscode.postMessage({ command: 'exportData' }); }
    function importData() { vscode.postMessage({ command: 'importData' }); }
    function resetAll() { vscode.postMessage({ command: 'resetAll' }); }
    function purgeWorkspace() { vscode.postMessage({ command: 'purgeWorkspace' }); }
    function startProblem(slug) { vscode.postMessage({ command: 'startProblem', slug: slug }); }
  </script>
</body>
</html>`;
  }
}

import * as vscode from "vscode";
import type { StorageManager } from "../storage/storage-manager";
import { StatsCalculator } from "./stats-calculator";

export class LeetFlowStatsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | undefined> =
    this._onDidChangeTreeData.event;

  constructor(private storage: StorageManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const stats = await StatsCalculator.computeSummary(this.storage);
      const activePct =
        stats.activeTrackTotal > 0
          ? Math.round((stats.activeTrackSolved / stats.activeTrackTotal) * 100)
          : 0;

      const items: vscode.TreeItem[] = [
        this.createItem(
          `🏆 Overall Grade: ${stats.trend.overallGrade} (${stats.trend.overallMasteryPct}% Mastery)`,
          "overall_grade",
          vscode.TreeItemCollapsibleState.None,
          "award",
        ),
        this.createItem(
          `🔥 Solve Streak: ${stats.trend.streakDays} days (${stats.trend.solvedLast7Days} this week)`,
          "streak",
          vscode.TreeItemCollapsibleState.None,
          "flame",
        ),
        this.createItem(
          `📌 ${stats.activeTrackName}: ${stats.activeTrackSolved}/${stats.activeTrackTotal} (${activePct}%)`,
          "active_track",
          vscode.TreeItemCollapsibleState.None,
          "bookmark",
        ),
        this.createItem(
          `⚡ Zero-Shot Pass Rate: ${stats.zeroShotRate}% (${stats.trend.smoothRatePct}% Smooth)`,
          "accuracy",
          vscode.TreeItemCollapsibleState.None,
          "zap",
        ),
        this.createItem(
          `⏱ Avg Duration: ${stats.avgDurationMinutes}m`,
          "time",
          vscode.TreeItemCollapsibleState.None,
          "clock",
        ),
        this.createItem(
          "📈 Topic Mastery & Grades",
          "mastery_root",
          vscode.TreeItemCollapsibleState.Expanded,
          "graph",
        ),
        this.createItem(
          "📊 Open Console & Control Dashboard",
          "open_dash",
          vscode.TreeItemCollapsibleState.None,
          "dashboard",
          {
            command: "leetflow.console",
            title: "Open Console",
          },
        ),
      ];

      return items;
    }

    if (element.contextValue === "mastery_root") {
      const stats = await StatsCalculator.computeSummary(this.storage);
      if (stats.topicMasteries.length === 0) {
        const item = new vscode.TreeItem("No topics practiced yet");
        item.iconPath = new vscode.ThemeIcon("info");
        return [item];
      }

      return stats.topicMasteries.map((m) => {
        const item = new vscode.TreeItem(m.topic, vscode.TreeItemCollapsibleState.None);
        item.description = `${m.masteryPct}% [${m.grade}] · ${m.solvedCount} solved`;
        item.iconPath = new vscode.ThemeIcon(
          m.masteryPct >= 80 ? "pass-filled" : "symbol-class",
          new vscode.ThemeColor(m.masteryPct >= 80 ? "charts.green" : "charts.yellow"),
        );
        return item;
      });
    }

    return [];
  }

  private createItem(
    label: string,
    contextValue: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    iconName?: string,
    command?: vscode.Command,
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(label, collapsibleState);
    item.contextValue = contextValue;
    item.command = command;
    if (iconName) {
      item.iconPath = new vscode.ThemeIcon(iconName);
    }
    return item;
  }
}

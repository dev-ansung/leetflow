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
          `🏆 Interview Readiness: ${stats.trend.readinessPct}% [Grade ${stats.trend.grade}]`,
          "readiness",
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
          `📊 Solved: ${stats.trend.easySolved} Easy · ${stats.trend.mediumSolved} Med · ${stats.trend.hardSolved} Hard`,
          "difficulty_dist",
          vscode.TreeItemCollapsibleState.None,
          "symbol-structure",
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
          "📊 Dashboard",
          "open_dash",
          vscode.TreeItemCollapsibleState.None,
          "dashboard",
          {
            command: "leetflow.console",
            title: "Open Dashboard",
          },
        ),
      ];

      return items;
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

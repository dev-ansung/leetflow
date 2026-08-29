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
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const stats = await StatsCalculator.computeSummary(this.storage);
      const b75Pct =
        stats.blind75Total > 0 ? Math.round((stats.blind75Solved / stats.blind75Total) * 100) : 0;

      const items: vscode.TreeItem[] = [
        this.createItem(
          `🏆 Solved: ${stats.totalSolved} Problems`,
          "summary",
          vscode.TreeItemCollapsibleState.None,
          "check-all",
        ),
        this.createItem(
          `🔥 Blind 75: ${stats.blind75Solved}/${stats.blind75Total} (${b75Pct}%)`,
          "b75",
          vscode.TreeItemCollapsibleState.None,
          "flame",
        ),
        this.createItem(
          `⚡ Zero-Shot Pass Rate: ${stats.zeroShotRate}%`,
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
          "📈 Topic Mastery & Elo",
          "elo_root",
          vscode.TreeItemCollapsibleState.Expanded,
          "graph",
        ),
        this.createItem(
          "📊 Open Full Stats Dashboard",
          "open_dash",
          vscode.TreeItemCollapsibleState.None,
          "window",
          {
            command: "leetflow.stats",
            title: "Open Dashboard",
          },
        ),
      ];

      return items;
    }

    if (element.contextValue === "elo_root") {
      const stats = await StatsCalculator.computeSummary(this.storage);
      if (stats.topicMasteries.length === 0) {
        const item = new vscode.TreeItem("No topics practiced yet");
        item.iconPath = new vscode.ThemeIcon("info");
        return [item];
      }

      return stats.topicMasteries.map((m) => {
        const item = new vscode.TreeItem(m.topic, vscode.TreeItemCollapsibleState.None);
        item.description = `Elo: ${m.elo} (${m.solvedCount} solved)`;
        item.iconPath = new vscode.ThemeIcon(
          "symbol-class",
          new vscode.ThemeColor("charts.yellow"),
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

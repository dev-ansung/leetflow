import * as vscode from "vscode";
import { BLIND_75_SEED } from "../providers/leetcode";

export class LeetFlowTracksProvider implements vscode.TreeDataProvider<TrackItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TrackItem | undefined | null | undefined> =
    new vscode.EventEmitter<TrackItem | undefined | null | undefined>();
  readonly onDidChangeTreeData: vscode.Event<TrackItem | undefined | null | undefined> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrackItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TrackItem): Thenable<TrackItem[]> {
    if (!element) {
      return Promise.resolve([
        new TrackItem(
          "🎯 Next Recommended Problem",
          "recommendation",
          vscode.TreeItemCollapsibleState.None,
          {
            command: "leetflow.next",
            title: "Next Problem",
          },
        ),
        new TrackItem(
          "🔥 Blind 75 Roadmap",
          "blind75_root",
          vscode.TreeItemCollapsibleState.Expanded,
        ),
        new TrackItem(
          "⏰ Spaced Review Queue",
          "review_root",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
      ]);
    }

    if (element.contextValue === "blind75_root") {
      const items = BLIND_75_SEED.map(
        (p) =>
          new TrackItem(
            `#${p.id} ${p.title} (${p.difficulty})`,
            "problem_item",
            vscode.TreeItemCollapsibleState.None,
            {
              command: "leetflow.startProblem",
              title: "Start Problem",
              arguments: [p.slug],
            },
            p.topic,
          ),
      );
      return Promise.resolve(items);
    }

    if (element.contextValue === "review_root") {
      return Promise.resolve([
        new TrackItem(
          "All caught up! No reviews due today.",
          "info",
          vscode.TreeItemCollapsibleState.None,
        ),
      ]);
    }

    return Promise.resolve([]);
  }
}

export class TrackItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly contextValue: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly command?: vscode.Command,
    public readonly description?: string,
  ) {
    super(label, collapsibleState);
    this.contextValue = contextValue;
    this.command = command;
    this.description = description;

    if (contextValue === "recommendation") {
      this.iconPath = new vscode.ThemeIcon("zap", new vscode.ThemeColor("charts.yellow"));
    } else if (contextValue === "blind75_root") {
      this.iconPath = new vscode.ThemeIcon("list-ordered");
    } else if (contextValue === "review_root") {
      this.iconPath = new vscode.ThemeIcon("history");
    } else if (contextValue === "problem_item") {
      this.iconPath = new vscode.ThemeIcon("code");
    }
  }
}

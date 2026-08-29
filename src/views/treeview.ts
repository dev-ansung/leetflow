import * as vscode from "vscode";
import { CURRICULUM_DATASET, type CurriculumProblem } from "../data/curriculum";
import type { StorageManager } from "../storage/storage-manager";

export class LeetFlowTracksProvider implements vscode.TreeDataProvider<TrackItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TrackItem | undefined | null | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<TrackItem | undefined | null | undefined> =
    this._onDidChangeTreeData.event;

  constructor(private storage?: StorageManager) {}

  setStorage(storage: StorageManager) {
    this.storage = storage;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TrackItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TrackItem): Promise<TrackItem[]> {
    if (!element) {
      return [
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
          "📚 Topics & Categories",
          "topics_root",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
        new TrackItem(
          "⏰ Spaced Review Queue",
          "review_root",
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
      ];
    }

    const attempts = this.storage ? await this.storage.getAttempts() : [];
    const solvedSlugs = new Set(attempts.filter((a) => a.passed).map((a) => a.slug));

    if (element.contextValue === "blind75_root") {
      const b75 = CURRICULUM_DATASET.filter((p) => p.isBlind75);
      return b75.map((p) => this.createProblemItem(p, solvedSlugs.has(p.slug)));
    }

    if (element.contextValue === "topics_root") {
      const topics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
      return topics.map((t) => {
        const count = CURRICULUM_DATASET.filter((p) => p.topic === t).length;
        const solved = CURRICULUM_DATASET.filter(
          (p) => p.topic === t && solvedSlugs.has(p.slug),
        ).length;
        return new TrackItem(
          `${t} (${solved}/${count})`,
          `topic_${t}`,
          vscode.TreeItemCollapsibleState.Collapsed,
          undefined,
          `${Math.round((solved / count) * 100)}%`,
        );
      });
    }

    if (element.contextValue?.startsWith("topic_")) {
      const topicName = element.contextValue.replace("topic_", "");
      const problems = CURRICULUM_DATASET.filter((p) => p.topic === topicName);
      return problems.map((p) => this.createProblemItem(p, solvedSlugs.has(p.slug)));
    }

    if (element.contextValue === "review_root") {
      return [
        new TrackItem(
          "All caught up! No reviews due today.",
          "info",
          vscode.TreeItemCollapsibleState.None,
        ),
      ];
    }

    return [];
  }

  private createProblemItem(p: CurriculumProblem, isSolved: boolean): TrackItem {
    const icon = isSolved ? "$(pass-filled)" : "$(circle-outline)";
    return new TrackItem(
      `${icon} #${p.id} ${p.title} (${p.difficulty})`,
      "problem_item",
      vscode.TreeItemCollapsibleState.None,
      {
        command: "leetflow.startProblem",
        title: "Start Problem",
        arguments: [p.slug],
      },
      p.pattern,
    );
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
    } else if (contextValue === "topics_root") {
      this.iconPath = new vscode.ThemeIcon("folder");
    } else if (contextValue === "review_root") {
      this.iconPath = new vscode.ThemeIcon("history");
    } else if (contextValue === "problem_item") {
      this.iconPath = new vscode.ThemeIcon("code");
    }
  }
}

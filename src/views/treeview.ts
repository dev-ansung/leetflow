import * as vscode from "vscode";
import { CURRICULUM_DATASET, type CurriculumProblem } from "../data/curriculum";
import type { StorageManager } from "../storage/storage-manager";

export class LeetFlowTracksProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | null | undefined
  >();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | undefined> =
    this._onDidChangeTreeData.event;

  constructor(private storage?: StorageManager) {}

  setStorage(storage: StorageManager) {
    this.storage = storage;
    this.refresh();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const attempts = this.storage ? await this.storage.getAttempts() : [];
    const solvedSlugs = new Set(attempts.filter((a) => a.passed).map((a) => a.slug));

    if (!element) {
      const b75 = CURRICULUM_DATASET.filter((p) => p.isBlind75);
      const b75Solved = b75.filter((p) => solvedSlugs.has(p.slug)).length;

      const nextItem = new vscode.TreeItem(
        "Next Recommended Problem",
        vscode.TreeItemCollapsibleState.None,
      );
      nextItem.iconPath = new vscode.ThemeIcon("zap", new vscode.ThemeColor("charts.yellow"));
      nextItem.command = { command: "leetflow.next", title: "Next Problem" };
      nextItem.description = "Auto-calibrated";

      const b75Root = new vscode.TreeItem(
        "Blind 75 Roadmap",
        vscode.TreeItemCollapsibleState.Expanded,
      );
      b75Root.contextValue = "blind75_root";
      b75Root.iconPath = new vscode.ThemeIcon("list-ordered");
      b75Root.description = `${b75Solved}/${b75.length} (${Math.round((b75Solved / b75.length) * 100)}%)`;

      const topicsRoot = new vscode.TreeItem(
        "All Topics & Patterns",
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      topicsRoot.contextValue = "topics_root";
      topicsRoot.iconPath = new vscode.ThemeIcon("folder");

      return [nextItem, b75Root, topicsRoot];
    }

    if (element.contextValue === "blind75_root") {
      const b75 = CURRICULUM_DATASET.filter((p) => p.isBlind75);
      const topics = Array.from(new Set(b75.map((p) => p.topic)));

      return topics.map((t) => {
        const topicProblems = b75.filter((p) => p.topic === t);
        const solvedCount = topicProblems.filter((p) => solvedSlugs.has(p.slug)).length;
        const totalCount = topicProblems.length;

        const topicFolder = new vscode.TreeItem(t, vscode.TreeItemCollapsibleState.Collapsed);
        topicFolder.contextValue = `b75_topic_${t}`;
        topicFolder.description = `${solvedCount}/${totalCount}`;
        topicFolder.iconPath =
          solvedCount === totalCount
            ? new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"))
            : new vscode.ThemeIcon("symbol-folder");
        return topicFolder;
      });
    }

    if (element.contextValue?.startsWith("b75_topic_")) {
      const topicName = element.contextValue.replace("b75_topic_", "");
      const problems = CURRICULUM_DATASET.filter((p) => p.isBlind75 && p.topic === topicName);
      return problems.map((p) => this.createProblemItem(p, solvedSlugs.has(p.slug)));
    }

    if (element.contextValue === "topics_root") {
      const topics = Array.from(new Set(CURRICULUM_DATASET.map((p) => p.topic)));
      return topics.map((t) => {
        const topicProblems = CURRICULUM_DATASET.filter((p) => p.topic === t);
        const solvedCount = topicProblems.filter((p) => solvedSlugs.has(p.slug)).length;
        const totalCount = topicProblems.length;

        const topicFolder = new vscode.TreeItem(t, vscode.TreeItemCollapsibleState.Collapsed);
        topicFolder.contextValue = `all_topic_${t}`;
        topicFolder.description = `${solvedCount}/${totalCount}`;
        topicFolder.iconPath = new vscode.ThemeIcon("folder");
        return topicFolder;
      });
    }

    if (element.contextValue?.startsWith("all_topic_")) {
      const topicName = element.contextValue.replace("all_topic_", "");
      const problems = CURRICULUM_DATASET.filter((p) => p.topic === topicName);
      return problems.map((p) => this.createProblemItem(p, solvedSlugs.has(p.slug)));
    }

    return [];
  }

  private createProblemItem(p: CurriculumProblem, isSolved: boolean): vscode.TreeItem {
    const item = new vscode.TreeItem(`#${p.id} ${p.title}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "problem_item";
    item.description = `${p.difficulty} · ${p.pattern}`;
    item.command = {
      command: "leetflow.startProblem",
      title: "Start Problem",
      arguments: [p.slug],
    };

    if (isSolved) {
      item.iconPath = new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"));
    } else {
      const color =
        p.difficulty === "Easy"
          ? new vscode.ThemeColor("charts.green")
          : p.difficulty === "Medium"
            ? new vscode.ThemeColor("charts.yellow")
            : new vscode.ThemeColor("charts.red");
      item.iconPath = new vscode.ThemeIcon("circle-outline", color);
    }

    return item;
  }
}

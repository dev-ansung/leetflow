import * as vscode from "vscode";
import { TrackRegistry } from "../data/track-registry";
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
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const attempts = this.storage ? await this.storage.getAttempts() : [];
    const solvedSlugs = new Set(attempts.filter((a) => a.passed).map((a) => a.slug));
    const activeTrackId = this.storage ? await this.storage.getActiveTrackId() : "blind75";
    const activeTrack = TrackRegistry.getTrack(activeTrackId);

    if (!element) {
      const activeProblems = TrackRegistry.getTrackProblems(activeTrack.id);
      const activeSolved = activeProblems.filter((p) => solvedSlugs.has(p.slug)).length;
      const _activePct =
        activeProblems.length > 0 ? Math.round((activeSolved / activeProblems.length) * 100) : 0;

      // 1. Next Problem Action
      const nextItem = new vscode.TreeItem(
        "Next Recommended Problem",
        vscode.TreeItemCollapsibleState.None,
      );
      nextItem.iconPath = new vscode.ThemeIcon("zap", new vscode.ThemeColor("charts.yellow"));
      nextItem.command = { command: "leetflow.next", title: "Next Problem" };
      nextItem.description = `Auto-match (${activeTrack.name})`;

      // 2. Render Active Track Categories Directly
      const categoryFolders = activeTrack.categories.map((cat) => {
        const catProblems = cat.problems;
        const catSolved = catProblems.filter((p) => solvedSlugs.has(p.slug)).length;
        const totalCount = catProblems.length;

        const catFolder = new vscode.TreeItem(cat.name, vscode.TreeItemCollapsibleState.Collapsed);
        catFolder.contextValue = `cat_${activeTrack.id}_${cat.name}`;
        catFolder.description = `${catSolved}/${totalCount}`;
        catFolder.iconPath =
          catSolved === totalCount && totalCount > 0
            ? new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"))
            : new vscode.ThemeIcon("symbol-folder");
        return catFolder;
      });

      return [nextItem, ...categoryFolders];
    }

    // Expanding Category
    if (element.contextValue?.startsWith("cat_")) {
      const parts = element.contextValue.split("_");
      const trackId = parts[1];
      const catName = parts.slice(2).join("_");
      const track = TrackRegistry.getTrack(trackId);
      const cat = track.categories.find((c) => c.name === catName);

      if (!cat) return [];
      return cat.problems.map((p) => this.createProblemItem(p, cat.name, solvedSlugs.has(p.slug)));
    }

    return [];
  }

  private createProblemItem(
    p: { id: number; slug: string; title: string; difficulty: "Easy" | "Medium" | "Hard" },
    _topic: string,
    isSolved: boolean,
  ): vscode.TreeItem {
    const item = new vscode.TreeItem(`#${p.id} ${p.title}`, vscode.TreeItemCollapsibleState.None);
    item.contextValue = "problem_item";
    item.description = `${p.difficulty}`;
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

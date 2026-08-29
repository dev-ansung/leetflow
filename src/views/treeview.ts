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
    this._onDidChangeTreeData.fire();
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
      const activePct =
        activeProblems.length > 0 ? Math.round((activeSolved / activeProblems.length) * 100) : 0;

      // 1. Next Problem
      const nextItem = new vscode.TreeItem(
        "Next Recommended Problem",
        vscode.TreeItemCollapsibleState.None,
      );
      nextItem.iconPath = new vscode.ThemeIcon("zap", new vscode.ThemeColor("charts.yellow"));
      nextItem.command = { command: "leetflow.next", title: "Next Problem" };
      nextItem.description = `Auto-match (${activeTrack.name})`;

      // 2. Quick Open
      const openItem = new vscode.TreeItem(
        "Open Problem by # / URL",
        vscode.TreeItemCollapsibleState.None,
      );
      openItem.iconPath = new vscode.ThemeIcon("search", new vscode.ThemeColor("charts.blue"));
      openItem.command = { command: "leetflow.openProblem", title: "Open Problem" };
      openItem.description = "Quick open";

      // 3. Switch Track
      const switchItem = new vscode.TreeItem(
        "Switch Active Roadmap...",
        vscode.TreeItemCollapsibleState.None,
      );
      switchItem.iconPath = new vscode.ThemeIcon("sync", new vscode.ThemeColor("charts.purple"));
      switchItem.command = { command: "leetflow.switchTrack", title: "Switch Roadmap" };
      switchItem.description = activeTrack.name;

      // 4. Active Track Root
      const activeRoot = new vscode.TreeItem(
        `🎯 ${activeTrack.name}`,
        vscode.TreeItemCollapsibleState.Expanded,
      );
      activeRoot.contextValue = `track_root_${activeTrack.id}`;
      activeRoot.iconPath = new vscode.ThemeIcon("target");
      activeRoot.description = `${activeSolved}/${activeProblems.length} (${activePct}%)`;

      // 5. All Tracks Folder
      const allTracksRoot = new vscode.TreeItem(
        "📚 All Curated Roadmaps",
        vscode.TreeItemCollapsibleState.Collapsed,
      );
      allTracksRoot.contextValue = "all_tracks_root";
      allTracksRoot.iconPath = new vscode.ThemeIcon("library");
      allTracksRoot.description = `${TrackRegistry.getAllTracks().length} study plans`;

      return [nextItem, openItem, switchItem, activeRoot, allTracksRoot];
    }

    // Expanding Active Track
    if (element.contextValue?.startsWith("track_root_")) {
      const trackId = element.contextValue.replace("track_root_", "");
      const track = TrackRegistry.getTrack(trackId);

      return track.categories.map((cat) => {
        const catProblems = cat.problems;
        const solvedCount = catProblems.filter((p) => solvedSlugs.has(p.slug)).length;
        const totalCount = catProblems.length;

        const catFolder = new vscode.TreeItem(cat.name, vscode.TreeItemCollapsibleState.Collapsed);
        catFolder.contextValue = `cat_${track.id}_${cat.name}`;
        catFolder.description = `${solvedCount}/${totalCount}`;
        catFolder.iconPath =
          solvedCount === totalCount && totalCount > 0
            ? new vscode.ThemeIcon("pass-filled", new vscode.ThemeColor("charts.green"))
            : new vscode.ThemeIcon("symbol-folder");
        return catFolder;
      });
    }

    // Expanding Category inside Track
    if (element.contextValue?.startsWith("cat_")) {
      const parts = element.contextValue.split("_");
      const trackId = parts[1];
      const catName = parts.slice(2).join("_");
      const track = TrackRegistry.getTrack(trackId);
      const cat = track.categories.find((c) => c.name === catName);

      if (!cat) return [];
      return cat.problems.map((p) => this.createProblemItem(p, cat.name, solvedSlugs.has(p.slug)));
    }

    // Expanding "All Curated Roadmaps"
    if (element.contextValue === "all_tracks_root") {
      const allTracks = TrackRegistry.getAllTracks();
      return allTracks.map((t) => {
        const tProblems = TrackRegistry.getTrackProblems(t.id);
        const solvedCount = tProblems.filter((p) => solvedSlugs.has(p.slug)).length;
        const totalCount = tProblems.length;
        const pct = totalCount > 0 ? Math.round((solvedCount / totalCount) * 100) : 0;

        const tItem = new vscode.TreeItem(t.name, vscode.TreeItemCollapsibleState.Collapsed);
        tItem.contextValue = `track_root_${t.id}`;
        tItem.description = `${solvedCount}/${totalCount} (${pct}%)`;
        tItem.iconPath = new vscode.ThemeIcon("book");
        return tItem;
      });
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

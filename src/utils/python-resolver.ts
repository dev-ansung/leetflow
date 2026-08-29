import { execSync } from "node:child_process";
import * as fs from "node:fs";

let vscode: any;
try {
  vscode = require("vscode");
} catch {
  vscode = undefined;
}

export interface PythonInterpreterInfo {
  path: string;
  version: string;
  isRecommended?: boolean;
}

export class PythonResolver {
  private static cachedPath?: string;

  static getActivePythonPath(): string {
    // 1. Explicit user config in LeetFlow
    if (vscode?.workspace) {
      const configPath = vscode.workspace.getConfiguration("leetflow").get("pythonPath")?.trim();
      if (configPath && fs.existsSync(configPath)) {
        return configPath;
      }

      // 2. VS Code Python extension setting
      const vsCodePyPath = vscode.workspace
        .getConfiguration("python")
        .get("defaultInterpreterPath")
        ?.trim();
      if (vsCodePyPath && fs.existsSync(vsCodePyPath)) {
        return vsCodePyPath;
      }
    }

    // 3. Cached discovery
    if (PythonResolver.cachedPath && fs.existsSync(PythonResolver.cachedPath)) {
      return PythonResolver.cachedPath;
    }

    // 4. Auto-discover best modern Python on system
    const candidates = PythonResolver.getSystemCandidates();
    for (const cand of candidates) {
      if (PythonResolver.testPython(cand)) {
        PythonResolver.cachedPath = cand;
        return cand;
      }
    }

    return "python3";
  }

  static setActivePythonPath(pyPath: string): void {
    PythonResolver.cachedPath = pyPath;
    if (vscode?.workspace) {
      vscode.workspace
        .getConfiguration("leetflow")
        .update("pythonPath", pyPath, vscode.ConfigurationTarget.Global);
    }
  }

  static getSystemCandidates(): string[] {
    const list: string[] = [
      "/opt/homebrew/bin/python3.14",
      "/usr/local/bin/python3.14",
      "/opt/homebrew/bin/python3.13",
      "/usr/local/bin/python3.13",
      "/opt/homebrew/bin/python3.12",
      "/usr/local/bin/python3.12",
      "/opt/homebrew/bin/python3",
      "/usr/local/bin/python3",
      "python3.14",
      "python3.13",
      "python3.12",
      "python3",
      "python",
    ];

    try {
      const whichOutput = execSync(
        "which -a python3.14 python3.13 python3.12 python3 uv 2>/dev/null",
        {
          encoding: "utf8",
        },
      );
      const whichLines = whichOutput
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && fs.existsSync(l));
      list.unshift(...whichLines);
    } catch {
      // ignore
    }

    return Array.from(new Set(list));
  }

  static testPython(pyPath: string): boolean {
    try {
      const out = execSync(`"${pyPath}" --version`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return out.includes("Python");
    } catch {
      return false;
    }
  }

  static getVersion(pyPath: string): string {
    try {
      const out = execSync(`"${pyPath}" --version`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return out.trim();
    } catch {
      return "Unknown Version";
    }
  }

  static async discoverInterpreters(): Promise<PythonInterpreterInfo[]> {
    const rawCandidates = PythonResolver.getSystemCandidates();
    const result: PythonInterpreterInfo[] = [];
    const seenPaths = new Set<string>();

    for (const cand of rawCandidates) {
      try {
        let resolved = cand;
        if (!cand.startsWith("/")) {
          resolved = execSync(`which "${cand}" 2>/dev/null`, { encoding: "utf8" }).trim();
        }
        if (!resolved || seenPaths.has(resolved) || !fs.existsSync(resolved)) continue;

        seenPaths.add(resolved);
        const version = PythonResolver.getVersion(resolved);
        if (version.startsWith("Python")) {
          const is314 = version.includes("3.14");
          result.push({
            path: resolved,
            version,
            isRecommended: is314,
          });
        }
      } catch {
        // ignore invalid binary
      }
    }

    return result.sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return b.version.localeCompare(a.version);
    });
  }
}

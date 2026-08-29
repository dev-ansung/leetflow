import { PythonModernizer } from "../modernizer/python-modernizer";
import type { Difficulty, Problem, TestCase } from "../types";

export class LeetCodeProvider {
  private static readonly GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

  static async fetchProblem(titleSlug: string): Promise<Problem> {
    const query = `
      query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
          questionFrontendId
          title
          titleSlug
          isPaidOnly
          difficulty
          content
          exampleTestcaseList
          hints
          metaData
          codeSnippets {
            langSlug
            code
          }
          topicTags {
            name
          }
        }
      }
    `;

    try {
      const response = await fetch(LeetCodeProvider.GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LeetFlow/0.1.0",
        },
        body: JSON.stringify({
          query,
          variables: { titleSlug },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const json: any = await response.json();
      const q = json?.data?.question;

      if (!q) {
        throw new Error(`Problem not found: ${titleSlug}`);
      }

      // If locked/paid, fallback to doocs mirror
      if (q.isPaidOnly || !q.content) {
        return await LeetCodeProvider.fetchFromMirror(
          parseInt(q.questionFrontendId, 10),
          titleSlug,
          q.title,
          q.difficulty,
        );
      }

      return LeetCodeProvider.parseGraphQLResponse(q);
    } catch (err: any) {
      console.warn(
        `GraphQL query failed for ${titleSlug}, attempting mirror fallback:`,
        err.message,
      );
      return await LeetCodeProvider.fetchFromMirror(1, titleSlug, titleSlug, "Medium");
    }
  }

  private static parseGraphQLResponse(q: any): Problem {
    const meta = q.metaData ? JSON.parse(q.metaData) : { name: "solution", params: [] };
    const pySnippet =
      q.codeSnippets?.find((s: any) => s.langSlug === "python3")?.code ||
      `class Solution:\n    def ${meta.name}(self):\n        pass\n`;

    const topics = q.topicTags?.map((t: any) => t.name) || ["Algorithms"];
    const testCases = LeetCodeProvider.parseTestCases(
      meta.params,
      q.exampleTestcaseList || [],
      q.content || "",
    );

    const diff: Difficulty =
      q.difficulty === "Hard" ? "Hard" : q.difficulty === "Medium" ? "Medium" : "Easy";
    const targetTimeSeconds = diff === "Easy" ? 900 : diff === "Medium" ? 1500 : 2700;

    return {
      id: parseInt(q.questionFrontendId, 10),
      title: q.title,
      slug: q.titleSlug,
      difficulty: diff,
      topics,
      descriptionHtml: q.content,
      starterCode: PythonModernizer.modernize(pySnippet),
      functionName: PythonModernizer.camelToSnake(meta.name),
      params: meta.params,
      testCases,
      hints: q.hints || [],
      targetTimeSeconds,
    };
  }

  private static parseTestCases(params: any[], rawList: string[], content: string): TestCase[] {
    const cases: TestCase[] = [];

    const expectedOutputs: any[] = [];
    const preRegex = /<pre>[\s\S]*?<\/pre>/gi;
    const preBlocks = content.match(preRegex) || [];

    for (const block of preBlocks) {
      const outRegex = /Output:?(?:<\/strong>)?[\s]*([^\n\r<]+)/i;
      const outMatch = block.match(outRegex);
      if (outMatch) {
        const clean = outMatch[1].trim().replace(/<[^>]+>/g, "");
        try {
          expectedOutputs.push(JSON.parse(clean));
        } catch {
          expectedOutputs.push(clean);
        }
      }
    }

    for (let i = 0; i < rawList.length; i++) {
      const lines = rawList[i].trim().split("\n");
      const inputArgs: Record<string, any> = {};

      for (let pIdx = 0; pIdx < params.length; pIdx++) {
        const paramName = params[pIdx]?.name || `arg${pIdx}`;
        const rawVal = lines[pIdx];

        if (rawVal !== undefined) {
          try {
            inputArgs[paramName] = JSON.parse(rawVal);
          } catch {
            inputArgs[paramName] = rawVal;
          }
        }
      }

      cases.push({
        id: i + 1,
        input: inputArgs,
        expected: expectedOutputs[i] !== undefined ? expectedOutputs[i] : null,
      });
    }

    if (cases.length === 0) {
      cases.push({
        id: 1,
        input: {},
        expected: null,
      });
    }

    return cases;
  }

  private static parseMarkdownTestCases(content: string): TestCase[] {
    const cases: TestCase[] = [];
    const unescaped = content
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    const preRegex = /<pre>[\s\S]*?<\/pre>/gi;
    const blocks = unescaped.match(preRegex) || [];

    let caseId = 1;
    for (const block of blocks) {
      const inMatch =
        block.match(/<strong>Input:?<\/strong>[\s]*([^\n\r<]+)/i) ||
        block.match(/Input:?[\s]*([^\n\r<]+)/i);
      const outMatch =
        block.match(/<strong>Output:?<\/strong>[\s]*([^\n\r<]+)/i) ||
        block.match(/Output:?[\s]*([^\n\r<]+)/i);

      if (inMatch) {
        const inStr = inMatch[1].trim();
        const inputArgs: Record<string, any> = {};

        const paramMatches = inStr.matchAll(
          /([a-zA-Z0-9_]+)\s*=\s*(\[[^\]]*\]|\{[^}]*\}|"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?|true|false|null)/gi,
        );
        for (const m of paramMatches) {
          try {
            inputArgs[m[1]] = JSON.parse(m[2].replace(/'/g, '"'));
          } catch {
            inputArgs[m[1]] = m[2];
          }
        }

        let expected: any = null;
        if (outMatch) {
          const outStr = outMatch[1].trim().replace(/<[^>]+>/g, "");
          try {
            expected = JSON.parse(outStr.replace(/'/g, '"'));
          } catch {
            expected = outStr;
          }
        }

        if (Object.keys(inputArgs).length > 0) {
          cases.push({
            id: caseId++,
            input: inputArgs,
            expected,
          });
        }
      }
    }

    if (cases.length === 0) {
      cases.push({
        id: 1,
        input: {},
        expected: null,
      });
    }

    return cases;
  }

  private static async fetchFromMirror(
    id: number,
    slug: string,
    title: string,
    diff: string,
  ): Promise<Problem> {
    const formattedId = String(id).padStart(4, "0");
    const folderStart = Math.floor((id || 1) / 100) * 100;
    const folderEnd = folderStart + 99;
    const folderRange = `${String(folderStart).padStart(4, "0")}-${String(folderEnd).padStart(4, "0")}`;

    const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "%20");
    const mirrorUrl = `https://raw.githubusercontent.com/doocs/leetcode/main/solution/${folderRange}/${formattedId}.${cleanTitle}/README_EN.md`;

    try {
      const resp = await fetch(mirrorUrl);
      if (!resp.ok) {
        throw new Error(`Mirror not found: ${resp.status}`);
      }
      const md = await resp.text();

      const descRegex = /<!-- description:start -->([\s\S]*?)<!-- description:end -->/;
      const descMatch = md.match(descRegex);
      const descHtml = descMatch ? descMatch[1] : `<p>Problem description for ${title}</p>`;

      const pyRegex = /```python([\s\S]*?)```/;
      const pyMatch = md.match(pyRegex);
      const fullPySolution = pyMatch ? pyMatch[1].trim() : "";

      // Extract function signature from solution code
      let functionName = "solve";
      let starterCode = "class Solution:\n    def solve(self):\n        pass\n";

      if (fullPySolution) {
        const sigMatch = fullPySolution.match(
          /(def\s+([a-zA-Z0-9_]+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:)/,
        );
        if (sigMatch) {
          const rawFnName = sigMatch[2];
          functionName = PythonModernizer.camelToSnake(rawFnName);
          const rawStarter = `class Solution:\n    ${sigMatch[1]}\n        pass\n`;
          starterCode = PythonModernizer.modernize(rawStarter);
        } else {
          starterCode = PythonModernizer.modernize(fullPySolution);
        }
      }

      const testCases = LeetCodeProvider.parseMarkdownTestCases(descHtml);

      return {
        id: id || 1,
        title: title || slug,
        slug,
        difficulty: (diff as Difficulty) || "Medium",
        topics: ["Algorithms"],
        descriptionHtml: descHtml,
        starterCode,
        functionName,
        params: [],
        testCases,
        hints: [],
        targetTimeSeconds: 1500,
      };
    } catch {
      return {
        id: id || 1,
        title: title || slug,
        slug,
        difficulty: "Medium",
        topics: ["Algorithms"],
        descriptionHtml: `<h3>${title}</h3><p>Problem details retrieved for practice.</p>`,
        starterCode: "class Solution:\n    def solve(self):\n        pass\n",
        functionName: "solve",
        params: [],
        testCases: [{ id: 1, input: {}, expected: null }],
        hints: [],
        targetTimeSeconds: 1500,
      };
    }
  }
}

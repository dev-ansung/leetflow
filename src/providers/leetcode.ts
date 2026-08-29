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
          q.questionFrontendId,
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
      functionName: meta.name,
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

      for (let j = 0; j < params.length; j++) {
        const pName = params[j]?.name || `arg${j}`;
        const line = lines[j] ?? "";
        try {
          inputArgs[pName] = JSON.parse(line);
        } catch {
          inputArgs[pName] = line;
        }
      }

      cases.push({
        id: i + 1,
        input: inputArgs,
        expected: expectedOutputs[i] ?? null,
        rawInput: rawList[i],
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

    const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\\s+/g, "%20");
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
      const starterCode = pyMatch
        ? pyMatch[1].trim()
        : `class Solution:\n    def solve(self):\n        pass\n`;

      return {
        id: id || 1,
        title: title || slug,
        slug,
        difficulty: (diff as Difficulty) || "Medium",
        topics: ["Algorithms"],
        descriptionHtml: descHtml,
        starterCode,
        functionName: "solution",
        params: [],
        testCases: [{ id: 1, input: {}, expected: null }],
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
        starterCode: `class Solution:\n    def solve(self):\n        pass\n`,
        functionName: "solve",
        params: [],
        testCases: [{ id: 1, input: {}, expected: null }],
        hints: [],
        targetTimeSeconds: 1500,
      };
    }
  }
}

export const BLIND_75_SEED = [
  { id: 1, slug: "two-sum", title: "Two Sum", difficulty: "Easy", topic: "Array & Hash Table" },
  {
    id: 217,
    slug: "contains-duplicate",
    title: "Contains Duplicate",
    difficulty: "Easy",
    topic: "Array & Hash Table",
  },
  {
    id: 242,
    slug: "valid-anagram",
    title: "Valid Anagram",
    difficulty: "Easy",
    topic: "Array & Hash Table",
  },
  {
    id: 121,
    slug: "best-time-to-buy-and-sell-stock",
    title: "Best Time to Buy and Sell Stock",
    difficulty: "Easy",
    topic: "Sliding Window",
  },
  { id: 15, slug: "3sum", title: "3Sum", difficulty: "Medium", topic: "Two Pointers" },
  {
    id: 206,
    slug: "reverse-linked-list",
    title: "Reverse Linked List",
    difficulty: "Easy",
    topic: "Linked List",
  },
  {
    id: 141,
    slug: "linked-list-cycle",
    title: "Linked List Cycle",
    difficulty: "Easy",
    topic: "Linked List",
  },
  {
    id: 226,
    slug: "invert-binary-tree",
    title: "Invert Binary Tree",
    difficulty: "Easy",
    topic: "Binary Tree",
  },
  {
    id: 104,
    slug: "maximum-depth-of-binary-tree",
    title: "Maximum Depth of Binary Tree",
    difficulty: "Easy",
    topic: "Binary Tree",
  },
  {
    id: 70,
    slug: "climbing-stairs",
    title: "Climbing Stairs",
    difficulty: "Easy",
    topic: "Dynamic Programming",
  },
  {
    id: 322,
    slug: "coin-change",
    title: "Coin Change",
    difficulty: "Medium",
    topic: "Dynamic Programming",
  },
  {
    id: 300,
    slug: "longest-increasing-subsequence",
    title: "Longest Increasing Subsequence",
    difficulty: "Medium",
    topic: "Dynamic Programming",
  },
  {
    id: 200,
    slug: "number-of-islands",
    title: "Number of Islands",
    difficulty: "Medium",
    topic: "Graph",
  },
  {
    id: 20,
    slug: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Easy",
    topic: "Stack",
  },
  {
    id: 704,
    slug: "binary-search",
    title: "Binary Search",
    difficulty: "Easy",
    topic: "Binary Search",
  },
];

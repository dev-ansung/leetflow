import { TrackRegistry } from "../data/track-registry";

export class ProblemResolver {
  private static readonly GRAPHQL_ENDPOINT = "https://leetcode.com/graphql";

  static parseInput(input: string): string {
    let clean = input.trim();
    if (!clean) return "";

    // Check for LeetCode URL format (e.g. https://leetcode.com/problems/container-with-most-water/...)
    const urlMatch = clean.match(/leetcode\.(?:com|cn)\/problems\/([^/?#\s]+)/i);
    if (urlMatch?.[1]) {
      return urlMatch[1].toLowerCase();
    }

    // Strip leading hash (e.g. #11 -> 11)
    if (clean.startsWith("#")) {
      clean = clean.slice(1).trim();
    }

    return clean;
  }

  static async resolveSlug(input: string): Promise<string> {
    const clean = ProblemResolver.parseInput(input);
    if (!clean) {
      throw new Error("Invalid problem input");
    }

    // 1. Check if numeric ID (e.g. "11" or "322")
    if (/^\d+$/.test(clean)) {
      const numId = parseInt(clean, 10);

      // Check track registry first (instant offline resolution across all roadmaps)
      const found = TrackRegistry.findProblem(numId);
      if (found) {
        return found.slug;
      }

      // Query LeetCode GraphQL by problem number
      const slugFromApi = await ProblemResolver.searchByNumberOrKeyword(clean);
      if (slugFromApi) {
        return slugFromApi;
      }

      throw new Error(`LeetCode problem #${numId} not found`);
    }

    // 2. If it is already a slug
    const foundBySlug = TrackRegistry.findProblem(clean);
    if (foundBySlug) {
      return foundBySlug.slug;
    }

    if (/^[a-z0-9-]+$/.test(clean)) {
      return clean;
    }

    // 3. Fallback search by title keywords
    const searchSlug = await ProblemResolver.searchByNumberOrKeyword(clean);
    if (searchSlug) {
      return searchSlug;
    }

    // If all else fails, convert title to kebab-case slug
    return clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private static async searchByNumberOrKeyword(queryStr: string): Promise<string | null> {
    const query = `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          limit: $limit
          skip: $skip
          filters: $filters
        ) {
          questions: data {
            frontendQuestionId: questionFrontendId
            title
            titleSlug
          }
        }
      }
    `;

    try {
      const response = await fetch(ProblemResolver.GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) LeetFlow/1.0.0",
        },
        body: JSON.stringify({
          query,
          variables: {
            categorySlug: "",
            limit: 10,
            skip: 0,
            filters: { searchKeywords: queryStr },
          },
        }),
      });

      if (!response.ok) return null;
      const json: any = await response.json();
      const questions: any[] = json?.data?.problemsetQuestionList?.questions || [];

      // If searching by number, find exact ID match
      if (/^\d+$/.test(queryStr)) {
        const exact = questions.find((q) => q.frontendQuestionId === queryStr);
        if (exact) return exact.titleSlug;
      }

      if (questions.length > 0) {
        return questions[0].titleSlug;
      }
    } catch {
      // Fallback
    }

    return null;
  }
}

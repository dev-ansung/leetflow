import { describe, expect, it } from "bun:test";
import { ProblemResolver } from "../../src/providers/problem-resolver";

describe("Problem Resolver & Search Suite", () => {
  it("should extract slug from LeetCode URLs", () => {
    expect(
      ProblemResolver.parseInput("https://leetcode.com/problems/container-with-most-water/"),
    ).toBe("container-with-most-water");

    expect(
      ProblemResolver.parseInput(
        "https://leetcode.com/problems/two-sum/description/?envType=study-plan",
      ),
    ).toBe("two-sum");

    expect(ProblemResolver.parseInput("https://leetcode.cn/problems/3sum/")).toBe("3sum");
  });

  it("should resolve problem numbers from curriculum catalog", async () => {
    expect(await ProblemResolver.resolveSlug("11")).toBe("container-with-most-water");
    expect(await ProblemResolver.resolveSlug("#1")).toBe("two-sum");
    expect(await ProblemResolver.resolveSlug("70")).toBe("climbing-stairs");
    expect(await ProblemResolver.resolveSlug("322")).toBe("coin-change");
  });

  it("should pass through valid slugs directly", async () => {
    expect(await ProblemResolver.resolveSlug("container-with-most-water")).toBe(
      "container-with-most-water",
    );
    expect(await ProblemResolver.resolveSlug("invert-binary-tree")).toBe("invert-binary-tree");
  });

  it("should query LeetCode GraphQL when resolving non-curriculum problem numbers", async () => {
    // Problem 12 (Integer to Roman - not in Blind 75)
    const slug = await ProblemResolver.resolveSlug("12");
    expect(slug).toBe("integer-to-roman");
  });
});

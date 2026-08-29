import { describe, expect, it } from "bun:test";
import { PythonModernizer } from "../../src/modernizer/python-modernizer";

describe("Python Template Modernizer Suite", () => {
  it("should convert camelCase method names to PEP 8 snake_case", () => {
    expect(PythonModernizer.camelToSnake("twoSum")).toBe("two_sum");
    expect(PythonModernizer.camelToSnake("lengthOfLongestSubstring")).toBe(
      "length_of_longest_substring",
    );
    expect(PythonModernizer.camelToSnake("minCostClimbingStairs")).toBe("min_cost_climbing_stairs");
    expect(PythonModernizer.camelToSnake("isPalindrome")).toBe("is_palindrome");
    expect(PythonModernizer.camelToSnake("maxProfit")).toBe("max_profit");
    expect(PythonModernizer.camelToSnake("kthSmallest")).toBe("kth_smallest");
    expect(PythonModernizer.camelToSnake("findMedianSortedArrays")).toBe(
      "find_median_sorted_arrays",
    );
  });

  it("should modernize typing generics to PEP 585 built-in collections", () => {
    const input = `
from typing import List, Dict, Set, Tuple

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        pass

    def topKFrequent(self, nums: List[int], k: int) -> List[int]:
        pass

    def groupAnagrams(self, strs: List[str]) -> List[List[str]]:
        pass

    def getCounts(self) -> Dict[str, List[int]]:
        pass
`;

    const modernized = PythonModernizer.modernize(input);
    expect(modernized).not.toContain("List[int]");
    expect(modernized).toContain("list[int]");
    expect(modernized).toContain("list[list[str]]");
    expect(modernized).toContain("dict[str, list[int]]");
    expect(modernized).toContain("def two_sum(");
    expect(modernized).toContain("def top_k_frequent(");
    expect(modernized).toContain("def group_anagrams(");
    expect(modernized).not.toContain("from typing import List");
  });

  it("should modernize Optional and Union types to PEP 604 union syntax", () => {
    const input = `
from typing import Optional, Union

class Solution:
    def invertTree(self, root: Optional[TreeNode]) -> Optional[TreeNode]:
        pass

    def parseValue(self, val: Union[int, str]) -> int:
        pass
`;

    const modernized = PythonModernizer.modernize(input);
    expect(modernized).not.toContain("Optional[TreeNode]");
    expect(modernized).toContain("TreeNode | None");
    expect(modernized).toContain("int | str");
    expect(modernized).toContain("def invert_tree(");
  });

  it("should automatically inject ListNode and TreeNode definitions when referenced", () => {
    const treeInput = `
class Solution:
    def maxDepth(self, root: Optional[TreeNode]) -> int:
        pass
`;
    const treeModernized = PythonModernizer.modernize(treeInput);
    expect(treeModernized).toContain("class TreeNode:");
    expect(treeModernized).toContain("def max_depth(");

    const listInput = `
class Solution:
    def reverseList(self, head: Optional[ListNode]) -> Optional[ListNode]:
        pass
`;
    const listModernized = PythonModernizer.modernize(listInput);
    expect(listModernized).toContain("class ListNode:");
    expect(listModernized).toContain("def reverse_list(");
  });

  it("should preserve user logic when migrating an existing solution", () => {
    const existingSolution = `
from typing import List

class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            diff = target - n
            if diff in seen:
                return [seen[diff], i]
            seen[n] = i
        return []
`;

    const modernized = PythonModernizer.modernize(existingSolution);
    expect(modernized).toContain("def two_sum(self, nums: list[int], target: int) -> list[int]:");
    expect(modernized).toContain("seen = {}");
    expect(modernized).toContain("for i, n in enumerate(nums):");
    expect(modernized).toContain("return [seen[diff], i]");
  });
});

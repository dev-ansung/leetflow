import { CURRICULUM_DATASET } from "./curriculum";

export class TopicNormalizer {
  private static readonly ALIAS_MAP: Record<string, string> = {
    Array: "Array & Hashing",
    "Hash Table": "Array & Hashing",
    "Hash Set": "Array & Hashing",
    Tree: "Binary Tree",
    "Binary Tree": "Binary Tree",
    "Binary Search Tree": "Binary Tree",
    "Heap (Priority Queue)": "Heap",
    Heap: "Heap",
    "Depth-First Search": "Graph",
    "Breadth-First Search": "Graph",
    Graph: "Graph",
    "Dynamic Programming": "Dynamic Programming",
    "Two Pointers": "Two Pointers",
    "Sliding Window": "Sliding Window",
    Stack: "Stack",
    "Monotonic Stack": "Stack",
    "Linked List": "Linked List",
    "Binary Search": "Binary Search",
    Backtracking: "Backtracking",
    Trie: "Trie",
    Intervals: "Intervals",
    Greedy: "Greedy",
    "Bit Manipulation": "Bit Manipulation",
    Math: "Math & Geometry",
    Geometry: "Math & Geometry",
  };

  static normalize(slug: string, rawTopics: string[] = []): string {
    const curProblem = CURRICULUM_DATASET.find((p) => p.slug === slug);
    if (curProblem) {
      return curProblem.topic;
    }

    for (const tag of rawTopics) {
      if (TopicNormalizer.ALIAS_MAP[tag]) {
        return TopicNormalizer.ALIAS_MAP[tag];
      }
    }

    if (rawTopics.length > 0 && rawTopics[0]) {
      const first = rawTopics[0];
      return TopicNormalizer.ALIAS_MAP[first] || first;
    }

    return "Algorithms";
  }

  static getLegacyAliases(canonicalTopic: string): string[] {
    const aliases: string[] = [canonicalTopic];
    for (const [raw, canon] of Object.entries(TopicNormalizer.ALIAS_MAP)) {
      if (canon === canonicalTopic && !aliases.includes(raw)) {
        aliases.push(raw);
      }
    }
    return aliases;
  }
}

export class PythonModernizer {
  private static readonly LIST_NODE_DEF = `class ListNode:
    def __init__(self, val: int = 0, next: "ListNode | None" = None):
        self.val = val
        self.next = next
`;

  private static readonly TREE_NODE_DEF = `class TreeNode:
    def __init__(self, val: int = 0, left: "TreeNode | None" = None, right: "TreeNode | None" = None):
        self.val = val
        self.left = left
        self.right = right
`;

  static camelToSnake(name: string): string {
    if (!name || name.startsWith("__")) return name;
    // Handle single letter capitalizations like topKFrequent -> top_k_frequent
    let s = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    // Handle consecutive capitals like HTTPServer -> http_server
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
    return s.toLowerCase();
  }

  static modernize(code: string): string {
    let result = code;

    // 1. Modernize typing generics (PEP 585 & PEP 604)
    // Replace List[...] -> list[...]
    result = result.replace(/\bList\[/g, "list[");
    result = result.replace(/\bDict\[/g, "dict[");
    result = result.replace(/\bSet\[/g, "set[");
    result = result.replace(/\bTuple\[/g, "tuple[");

    // Replace Optional[T] -> T | None
    result = result.replace(/\bOptional\[([^\]]+)\]/g, "$1 | None");

    // Replace Union[A, B] -> A | B
    result = result.replace(/\bUnion\[([^\]]+)\]/g, (_match, group) => {
      const parts = group.split(",").map((p: string) => p.trim());
      return parts.join(" | ");
    });

    // 2. Modernize method names (camelCase -> snake_case) on class Solution methods
    result = result.replace(
      /(def\s+)([a-zA-Z0-9_]+)(\s*\(self)/g,
      (_match, defPrefix, methodName, selfArgs) => {
        const snakeName = PythonModernizer.camelToSnake(methodName);
        return `${defPrefix}${snakeName}${selfArgs}`;
      },
    );

    // 3. Clean redundant typing imports
    result = result.replace(/^from\s+typing\s+import\s+.*[\r\n]*/gm, "");

    // 4. Inject ListNode / TreeNode helpers if referenced and not already declared
    const needsListNode =
      (result.includes("ListNode") || result.includes("list_node")) &&
      !result.includes("class ListNode");
    const needsTreeNode =
      (result.includes("TreeNode") || result.includes("tree_node")) &&
      !result.includes("class TreeNode");

    const helpers: string[] = [];
    if (needsListNode) {
      helpers.push(PythonModernizer.LIST_NODE_DEF);
    }
    if (needsTreeNode) {
      helpers.push(PythonModernizer.TREE_NODE_DEF);
    }

    if (helpers.length > 0) {
      result = `${helpers.join("\n")}\n${result.trimStart()}`;
    }

    return `${result.trim()}\n`;
  }
}

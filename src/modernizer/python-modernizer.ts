export class PythonModernizer {
  private static readonly FUTURE_IMPORT = "from __future__ import annotations";

  private static readonly LIST_NODE_DEF = `class ListNode:
    def __init__(self, val: int = 0, next: ListNode | None = None):
        self.val = val
        self.next = next
`;

  private static readonly TREE_NODE_DEF = `class TreeNode:
    def __init__(self, val: int = 0, left: TreeNode | None = None, right: TreeNode | None = None):
        self.val = val
        self.left = left
        self.right = right
`;

  static camelToSnake(name: string): string {
    if (!name || name.startsWith("__")) return name;
    let s = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2");
    s = s.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2");
    return s.toLowerCase();
  }

  static modernize(code: string): string {
    let result = code;

    // 1. Modernize typing generics (PEP 585 & PEP 604)
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

    // 3. Clean redundant typing imports & existing future imports
    result = result.replace(/^from\s+typing\s+import\s+.*[\r\n]*/gm, "");
    result = result.replace(/^from\s+__future__\s+import\s+.*[\r\n]*/gm, "");

    // 4. Clean out commented-out boilerplate definitions
    result = result.replace(
      /#\s*Definition for singly-linked list\.[\s\S]*?#\s*self\.next\s*=\s*next\s*\n?/gi,
      "",
    );
    result = result.replace(
      /#\s*Definition for a binary tree node\.[\s\S]*?#\s*self\.right\s*=\s*right\s*\n?/gi,
      "",
    );

    // 5. Check if uncommented class definition exists
    const hasUncommentedListNode = /(^|\n)class\s+ListNode[\s:(]/m.test(result);
    const hasUncommentedTreeNode = /(^|\n)class\s+TreeNode[\s:(]/m.test(result);

    const needsListNode =
      (result.includes("ListNode") || result.includes("list_node")) && !hasUncommentedListNode;
    const needsTreeNode =
      (result.includes("TreeNode") || result.includes("tree_node")) && !hasUncommentedTreeNode;

    const headerParts: string[] = [PythonModernizer.FUTURE_IMPORT];

    if (needsListNode) {
      headerParts.push(PythonModernizer.LIST_NODE_DEF.trim());
    }
    if (needsTreeNode) {
      headerParts.push(PythonModernizer.TREE_NODE_DEF.trim());
    }

    result = `${headerParts.join("\n\n")}\n\n${result.trimStart()}`;

    return `${result.trim()}\n`;
  }
}

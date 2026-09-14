export interface ThreadPosition {
  node: string;
  item: string;
  parent: string | null;
  depth: number;
}

export interface ThreadBranch<T> {
  node: T | null;
  position: ThreadPosition;
  children: ThreadBranch<T>[];
}

/** Build the outline once, including removed positions with no surviving descendants. */
export function buildThreadTree<T extends { node: string }>(
  nodes: readonly T[],
  structure: readonly ThreadPosition[],
): ThreadBranch<T>[] {
  const visible = new Map(nodes.map((node) => [node.node, node]));
  const branches = new Map(
    structure.map((position) => [
      position.node,
      {
        node: visible.get(position.node) ?? null,
        position,
        children: [] as ThreadBranch<T>[],
      },
    ]),
  );
  const roots: ThreadBranch<T>[] = [];
  for (const branch of branches.values()) {
    const parent =
      branch.position.parent === null
        ? undefined
        : branches.get(branch.position.parent);
    if (parent) parent.children.push(branch);
    else roots.push(branch);
  }
  return roots;
}

/** Called only when opening a moderation dialog, not once per rendered post. */
export function visibleDescendants<T extends { item: string }>(
  branch: ThreadBranch<T>,
): string[] {
  const items: string[] = [];
  const pending = [...branch.children].reverse();
  while (pending.length > 0) {
    const child = pending.pop()!;
    if (child.node) items.push(child.node.item);
    for (let index = child.children.length - 1; index >= 0; index -= 1) {
      pending.push(child.children[index]);
    }
  }
  return items;
}

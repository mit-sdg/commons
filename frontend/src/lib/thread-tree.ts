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

/** Replies hidden when a branch collapses, counted at every depth below it. */
export interface BranchSummary {
  replies: number;
  unread: number;
}

const POST_ANCHOR_PREFIX = "post-";

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

/** Fold child totals once, without recursive calls on deeply nested threads. */
export function summarizeBranches<T>(
  branches: readonly ThreadBranch<T>[],
  unreadItems: ReadonlySet<string>,
): Map<string, BranchSummary> {
  const ordered = [...branches];
  for (let index = 0; index < ordered.length; index += 1) {
    for (const child of ordered[index].children) ordered.push(child);
  }
  const summaries = new Map<string, BranchSummary>();
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const branch = ordered[index];
    let replies = 0;
    let unread = 0;
    for (const child of branch.children) {
      const summary = summaries.get(child.position.node);
      replies += 1 + (summary?.replies ?? 0);
      unread +=
        (summary?.unread ?? 0) + (unreadItems.has(child.position.item) ? 1 : 0);
    }
    summaries.set(branch.position.node, { replies, unread });
  }
  return summaries;
}

/** The anchor a post carries in the thread page, as `#post-<item>`. */
export function postAnchorItem(targetId: string): string | null {
  return targetId.startsWith(POST_ANCHOR_PREFIX)
    ? targetId.slice(POST_ANCHOR_PREFIX.length)
    : null;
}

/** Ancestors that must expand to reveal a deep-linked post, nearest first. */
export function ancestorNodes(
  structure: readonly ThreadPosition[],
  item: string,
): string[] {
  const parents = new Map(
    structure.map((position) => [position.node, position.parent]),
  );
  const start = structure.find((position) => position.item === item);
  const ancestors: string[] = [];
  let next = start ? (parents.get(start.node) ?? null) : null;
  while (next && !ancestors.includes(next)) {
    ancestors.push(next);
    next = parents.get(next) ?? null;
  }
  return ancestors;
}

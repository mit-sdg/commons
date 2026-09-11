import type { ThreadPage } from "@/lib/loaders";
import type { ThreadNode } from "@/lib/models";

export interface ThreadBranch {
  node: ThreadNode | null;
  position: ThreadPage["structure"][number];
  children: ThreadBranch[];
}

/** Replies hidden when a branch collapses, counted at every depth below it. */
export interface BranchSummary {
  replies: number;
  unread: number;
}

const POST_ANCHOR_PREFIX = "post-";

export function buildThreadTree(
  nodes: ThreadNode[],
  structure: ThreadPage["structure"],
): ThreadBranch[] {
  const visible = new Map(nodes.map((node) => [node.node, node]));
  const branches = new Map(
    structure.map((position) => [
      position.node,
      {
        node: visible.get(position.node) ?? null,
        position,
        children: [] as ThreadBranch[],
      },
    ]),
  );
  const roots: ThreadBranch[] = [];
  for (const branch of branches.values()) {
    const parent =
      branch.position.parent == null
        ? null
        : branches.get(branch.position.parent);
    if (parent) parent.children.push(branch);
    else roots.push(branch);
  }
  return roots;
}

/**
 * One bottom-up pass over the tree, so a branch reuses its children's totals
 * instead of walking its whole subtree again.
 */
export function summarizeBranches(
  branches: ReadonlyArray<ThreadBranch>,
  unreadItems: ReadonlySet<string>,
  into = new Map<string, BranchSummary>(),
): Map<string, BranchSummary> {
  for (const branch of branches) {
    summarizeBranches(branch.children, unreadItems, into);
    let replies = 0;
    let unread = 0;
    for (const child of branch.children) {
      const summary = into.get(String(child.position.node));
      replies += 1 + (summary?.replies ?? 0);
      unread +=
        (summary?.unread ?? 0) +
        (unreadItems.has(String(child.position.item)) ? 1 : 0);
    }
    into.set(String(branch.position.node), { replies, unread });
  }
  return into;
}

/** The anchor a post carries in the thread page, as `#post-<item>`. */
export function postAnchorItem(targetId: string): string | null {
  return targetId.startsWith(POST_ANCHOR_PREFIX)
    ? targetId.slice(POST_ANCHOR_PREFIX.length)
    : null;
}

/**
 * Nodes between a post and the thread root, nearest first. Collapsing any one
 * of them hides the post, so a deep link has to expand all of them.
 */
export function ancestorNodes(
  structure: ThreadPage["structure"],
  item: string,
): string[] {
  const parents = new Map(
    structure.map((position) => [
      String(position.node),
      position.parent == null ? null : String(position.parent),
    ]),
  );
  const start = structure.find((position) => String(position.item) === item);
  const ancestors: string[] = [];
  let next = start ? (parents.get(String(start.node)) ?? null) : null;
  while (next && !ancestors.includes(next)) {
    ancestors.push(next);
    next = parents.get(next) ?? null;
  }
  return ancestors;
}

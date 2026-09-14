import { describe, expect, test } from "bun:test";
import {
  ancestorNodes,
  buildThreadTree,
  postAnchorItem,
  summarizeBranches,
  type ThreadPosition,
  visibleDescendants,
} from "./thread-tree";

const structure: ThreadPosition[] = [
  { node: "root", item: "opening", parent: null, depth: 0 },
  { node: "middle", item: "removed", parent: "root", depth: 1 },
  { node: "leaf", item: "reply", parent: "middle", depth: 2 },
  { node: "other", item: "other-reply", parent: "root", depth: 1 },
];
const tree = () => buildThreadTree(structure, structure);

describe("removed positions and on-demand descendant selection", () => {
  test("a removed leaf and a wholly removed branch remain in the outline", () => {
    const [root] = buildThreadTree([structure[0]], structure);
    expect(root.children).toHaveLength(2);
    expect(root.children[0].node).toBeNull();
    expect(root.children[0].children[0].node).toBeNull();
    expect(root.children[1].node).toBeNull();
    expect(visibleDescendants(root)).toEqual([]);
    expect(summarizeBranches([root], new Set()).get("root")).toEqual({
      replies: 3,
      unread: 0,
    });
  });
  test("selection traverses removed parents but includes only retained visible replies", () => {
    const [root] = buildThreadTree(
      [structure[0], structure[2], structure[3]],
      structure,
    );
    expect(visibleDescendants(root)).toEqual(["reply", "other-reply"]);
    expect(visibleDescendants(root.children[0])).toEqual(["reply"]);
  });
  test("deep selection and collapse summaries are iterative", () => {
    const nodes = Array.from({ length: 10_000 }, (_, i) => ({
      node: `n${i}`,
      item: `p${i}`,
      parent: i === 0 ? null : `n${i - 1}`,
      depth: i,
    }));
    const [root] = buildThreadTree(nodes, nodes);
    const replies = visibleDescendants(root);
    expect(replies).toHaveLength(nodes.length - 1);
    expect(replies[0]).toBe("p1");
    expect(replies.at(-1)).toBe("p9999");
    expect(summarizeBranches([root], new Set(["p9999"])).get("n0")).toEqual({
      replies: nodes.length - 1,
      unread: 1,
    });
  });
});

test("a thread tree hangs every reply under its parent", () => {
  const roots = tree();
  expect(roots).toHaveLength(1);
  expect(roots[0].children.map((child) => child.position.item)).toEqual([
    "removed",
    "other-reply",
  ]);
  expect(roots[0].children[0].children[0].position.item).toBe("reply");
});

test("a branch counts the replies at every depth below it", () => {
  const summaries = summarizeBranches(tree(), new Set());
  expect(summaries.get("root")?.replies).toBe(3);
  expect(summaries.get("middle")?.replies).toBe(1);
  expect(summaries.get("leaf")?.replies).toBe(0);
});

test("collapsing hides unread replies, so a branch counts those too", () => {
  const summaries = summarizeBranches(
    tree(),
    new Set(["reply", "other-reply"]),
  );
  expect(summaries.get("root")?.unread).toBe(2);
  expect(summaries.get("middle")?.unread).toBe(1);
  expect(summaries.get("other")?.unread).toBe(0);
});

test("a post that is its own unread self is not counted against itself", () => {
  const summaries = summarizeBranches(tree(), new Set(["removed"]));
  expect(summaries.get("middle")?.unread).toBe(0);
  expect(summaries.get("root")?.unread).toBe(1);
});

test("a deep link names every branch that has to open", () => {
  expect(ancestorNodes(structure, "reply")).toEqual(["middle", "root"]);
  expect(ancestorNodes(structure, "opening")).toEqual([]);
  expect(ancestorNodes(structure, "missing")).toEqual([]);
});

test("only post anchors carry an item", () => {
  expect(postAnchorItem("post-reply")).toBe("reply");
  expect(postAnchorItem("discussion-list")).toBe(null);
});

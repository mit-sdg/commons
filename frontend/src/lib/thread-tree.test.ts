import { expect, test } from "bun:test";
import type { ThreadPage } from "./loaders";
import type { ThreadNode } from "./models";
import {
  ancestorNodes,
  buildThreadTree,
  postAnchorItem,
  summarizeBranches,
} from "./thread-tree";

// node, parent, item: a root with two replies, one of them two deep.
const rows = [
  ["n1", null, "i1"],
  ["n2", "n1", "i2"],
  ["n3", "n2", "i3"],
  ["n4", "n1", "i4"],
] as const;

const structure = rows.map(([node, parent, item], depth) => ({
  node,
  parent,
  item,
  depth,
})) as unknown as ThreadPage["structure"];

const nodes = rows.map(([node, , item]) => ({
  node,
  item,
})) as unknown as ThreadNode[];

const tree = () => buildThreadTree(nodes, structure);

test("a thread tree hangs every reply under its parent", () => {
  const roots = tree();
  expect(roots).toHaveLength(1);
  expect(roots[0].children.map((child) => child.position.item)).toEqual([
    "i2",
    "i4",
  ] as unknown as ThreadPage["structure"][number]["item"][]);
  expect(roots[0].children[0].children[0].position.item).toBe(
    "i3" as unknown as ThreadPage["structure"][number]["item"],
  );
});

test("a branch counts the replies at every depth below it", () => {
  const summaries = summarizeBranches(tree(), new Set());
  expect(summaries.get("n1")?.replies).toBe(3);
  expect(summaries.get("n2")?.replies).toBe(1);
  expect(summaries.get("n3")?.replies).toBe(0);
});

test("collapsing hides unread replies, so a branch counts those too", () => {
  const summaries = summarizeBranches(tree(), new Set(["i3", "i4"]));
  expect(summaries.get("n1")?.unread).toBe(2);
  expect(summaries.get("n2")?.unread).toBe(1);
  expect(summaries.get("n4")?.unread).toBe(0);
});

test("a post that is its own unread self is not counted against itself", () => {
  const summaries = summarizeBranches(tree(), new Set(["i2"]));
  expect(summaries.get("n2")?.unread).toBe(0);
  expect(summaries.get("n1")?.unread).toBe(1);
});

test("a deep link names every branch that has to open", () => {
  expect(ancestorNodes(structure, "i3")).toEqual(["n2", "n1"]);
  expect(ancestorNodes(structure, "i1")).toEqual([]);
  expect(ancestorNodes(structure, "missing")).toEqual([]);
});

test("only post anchors carry an item", () => {
  expect(postAnchorItem("post-i3")).toBe("i3");
  expect(postAnchorItem("discussion-list")).toBe(null);
});

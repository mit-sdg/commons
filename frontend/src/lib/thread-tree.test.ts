import { describe, expect, test } from "bun:test";
import {
  buildThreadTree,
  type ThreadPosition,
  visibleDescendants,
} from "./thread-tree";

describe("removed positions and on-demand descendant selection", () => {
  const structure: ThreadPosition[] = [
    { node: "root", item: "opening", parent: null, depth: 0 },
    { node: "middle", item: "removed", parent: "root", depth: 1 },
    { node: "leaf", item: "reply", parent: "middle", depth: 2 },
    { node: "other", item: "other-reply", parent: "root", depth: 1 },
  ];
  test("a removed leaf and a wholly removed branch remain in the outline", () => {
    const [root] = buildThreadTree([structure[0]], structure);
    expect(root.children).toHaveLength(2);
    expect(root.children[0].node).toBeNull();
    expect(root.children[0].children[0].node).toBeNull();
    expect(root.children[1].node).toBeNull();
    expect(visibleDescendants(root)).toEqual([]);
  });
  test("selection traverses removed parents but includes only retained visible replies", () => {
    const [root] = buildThreadTree(
      [structure[0], structure[2], structure[3]],
      structure,
    );
    expect(visibleDescendants(root)).toEqual(["reply", "other-reply"]);
    expect(visibleDescendants(root.children[0])).toEqual(["reply"]);
  });
  test("a deep selection is iterative and keeps thread order", () => {
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
  });
});

import { describe, expect, test } from "bun:test";
import type React from "react";
import { TaskMarkdown } from "./task-markdown.tsx";

/** Every element type in the tree, in document order. */
function tags(node: React.ReactNode, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) tags(child, found);
    return found;
  }
  if (node === null || typeof node !== "object") return found;
  const element = node as React.ReactElement<{ children?: React.ReactNode }>;
  if (typeof element.type === "string") found.push(element.type);
  tags(element.props?.children, found);
  return found;
}

/** All text in the tree, concatenated in document order. */
function text(node: React.ReactNode, parts: string[] = []): string {
  if (typeof node === "string") {
    parts.push(node);
    return parts.join("");
  }
  if (Array.isArray(node)) {
    for (const child of node) text(child, parts);
    return parts.join("");
  }
  if (node !== null && typeof node === "object") {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    text(element.props?.children, parts);
  }
  return parts.join("");
}

describe("TaskMarkdown", () => {
  test("renders null for empty content", () => {
    expect(TaskMarkdown({ content: "" })).toBeNull();
    expect(TaskMarkdown({ content: "   \n  " })).toBeNull();
  });

  test("renders formatted text for markdown features", () => {
    const markdown = `# Title 1
## Title 2
### Title 3

Here is a paragraph with **bold**, *italic*, ~~strikethrough~~, \`inline code\`, and a [link](https://example.com).

> Blockquote line 1
> Blockquote line 2

- Bullet 1
- Bullet 2

1. Numbered 1
2. Numbered 2

---

\`\`\`ts
const x = 1;
\`\`\`
`;
    const result = TaskMarkdown({ content: markdown });
    expect(result).not.toBeNull();
    expect(result?.props.className).toContain("prose-task");

    const rendered = tags(result);
    // Details sit under the card's own h3, so headings start at h4.
    expect(rendered).toContain("h4");
    expect(rendered).toContain("h5");
    expect(rendered).toContain("h6");
    expect(rendered).toContain("strong");
    expect(rendered).toContain("em");
    expect(rendered).toContain("del");
    expect(rendered).toContain("code");
    expect(rendered).toContain("a");
    expect(rendered).toContain("blockquote");
    expect(rendered).toContain("ul");
    expect(rendered).toContain("ol");
    expect(rendered).toContain("hr");
    expect(rendered).toContain("pre");
  });

  test("renders GFM task lists as checkboxes, not literal brackets", () => {
    const result = TaskMarkdown({
      content: "- [x] Done thing\n- [ ] Pending thing",
    });
    const body = text(result);
    expect(body).toContain("Done thing");
    expect(body).toContain("Pending thing");
    expect(body).not.toContain("[x]");
    expect(body).not.toContain("[ ]");
    // Screen readers still get the state the checkbox conveys visually.
    expect(body).toContain("Done: ");
    expect(body).toContain("Not done: ");
  });

  test("nests deeper list items under their parent", () => {
    const result = TaskMarkdown({
      content: "- Parent\n  - Child\n- Sibling",
    });
    const lists = tags(result).filter((tag) => tag === "ul");
    expect(lists.length).toBe(2);
    expect(text(result)).toContain("Child");
  });

  test("leaves underscores inside words alone", () => {
    const result = TaskMarkdown({ content: "Call some_helper_name today." });
    expect(text(result)).toBe("Call some_helper_name today.");
    expect(tags(result)).not.toContain("em");
  });

  test("keeps ordered and unordered runs in separate lists", () => {
    const result = TaskMarkdown({ content: "- Bullet\n1. Numbered" });
    const rendered = tags(result);
    expect(rendered).toContain("ul");
    expect(rendered).toContain("ol");
  });
});

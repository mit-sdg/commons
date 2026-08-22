import { describe, expect, test } from "bun:test";
import { TaskMarkdown } from "./task-markdown.tsx";

describe("TaskMarkdown", () => {
  test("renders null for empty content", () => {
    const result = TaskMarkdown({ content: "" });
    expect(result).toBeNull();
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

\`\`\`ts
const x = 1;
\`\`\`
`;
    const result = TaskMarkdown({ content: markdown });
    expect(result).not.toBeNull();
    expect(result?.props.className).toContain("prose-forum");
  });
});

import { Check } from "lucide-react";
import type React from "react";
import { Fragment } from "react";
import { cn } from "@/lib/utils";

/** Word characters, so `snake_case` and `a_b` survive emphasis parsing intact. */
const WORD = /[A-Za-z0-9]/;

const INLINE =
  /(`[^`]+`|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|___[^_]+___|__[^_]+__|_[^_]+_|~~[^~]+~~|\[[^\]]+\]\([^)]+\))/g;

function renderInline(text: string, prefix = ""): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = new RegExp(INLINE.source, "g");

  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${prefix}${match.index}`;

    // Underscore emphasis only counts between words, so identifiers stay whole.
    const underscored = token.startsWith("_");
    const before = text[match.index - 1];
    const after = text[match.index + token.length];
    const insideWord = WORD.test(before ?? "") || WORD.test(after ?? "");

    if (underscored && insideWord) {
      nodes.push(token);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (
      (token.startsWith("***") && token.endsWith("***")) ||
      (token.startsWith("___") && token.endsWith("___"))
    ) {
      nodes.push(
        <strong key={key}>
          <em>{renderInline(token.slice(3, -3), `${key}-`)}</em>
        </strong>,
      );
    } else if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong key={key}>
          {renderInline(token.slice(2, -2), `${key}-`)}
        </strong>,
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      nodes.push(
        <em key={key}>{renderInline(token.slice(1, -1), `${key}-`)}</em>,
      );
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      nodes.push(
        <del key={key}>{renderInline(token.slice(2, -2), `${key}-`)}</del>,
      );
    } else if (token.startsWith("[") && token.includes("](")) {
      const closeBracket = token.indexOf("](");
      const label = token.slice(1, closeBracket);
      const url = token.slice(closeBracket + 2, -1);
      nodes.push(
        <a key={key} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    } else {
      nodes.push(token);
    }

    lastIndex = regex.lastIndex;
    match = regex.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

/** `- item`, `* item`, `+ item`, `1. item`, `1) item`, with leading indent. */
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
/** GFM task-list marker at the head of a list item: `[ ]` or `[x]`. */
const TASK_MARKER = /^\[([ xX])\]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^(?:-{3,}|\*{3,}|_{3,})$/;

interface ListItemNode {
  content: string;
  /** `null` when the item is not a task-list item. */
  checked: boolean | null;
  children: ListNode | null;
}

interface ListNode {
  ordered: boolean;
  items: ListItemNode[];
}

/** Collect one list (and any deeper lists nested under its items). */
function parseList(
  lines: string[],
  start: number,
  indent: number,
): [ListNode, number] {
  const opening = LIST_ITEM.exec(lines[start]);
  const ordered = opening !== null && /\d/.test(opening[2]);
  const items: ListItemNode[] = [];
  let i = start;

  while (i < lines.length) {
    const match = LIST_ITEM.exec(lines[i]);
    if (match === null) break;

    const itemIndent = match[1].length;
    if (itemIndent < indent) break;

    if (itemIndent > indent) {
      const [child, next] = parseList(lines, i, itemIndent);
      const parent = items[items.length - 1];
      // A deeper list with no item to hang from is treated as a sibling list.
      if (parent === undefined) break;
      parent.children = child;
      i = next;
      continue;
    }

    // A marker change (bullet vs number) starts a new list.
    if (/\d/.test(match[2]) !== ordered) break;

    const task = TASK_MARKER.exec(match[3]);
    items.push({
      content: task === null ? match[3] : task[2],
      checked: task === null ? null : task[1].toLowerCase() === "x",
      children: null,
    });
    i++;
  }

  return [{ ordered, items }, i];
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-[0.28em] inline-flex size-[0.9em] shrink-0 items-center justify-center rounded-[0.25em] border",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/50",
      )}
    >
      {checked ? <Check className="size-[0.7em]" strokeWidth={3.5} /> : null}
    </span>
  );
}

function renderList(node: ListNode, key: string): React.ReactNode {
  const hasTasks = node.items.some((item) => item.checked !== null);
  const List = node.ordered && !hasTasks ? "ol" : "ul";

  return (
    <List key={key} className={hasTasks ? "prose-task-checklist" : undefined}>
      {node.items.map((item, index) => {
        const itemKey = `${key}-${index}`;
        const body = (
          <>
            <span
              className={cn(
                item.checked && "text-muted-foreground/70 line-through",
              )}
            >
              {renderInline(item.content, `${itemKey}-`)}
            </span>
            {item.children ? renderList(item.children, `${itemKey}-sub`) : null}
          </>
        );

        if (item.checked === null && !hasTasks) {
          return <li key={itemKey}>{body}</li>;
        }

        // Inside a checklist every row aligns on the same gutter, so plain
        // items get a bullet of their own where the checkbox would sit.
        return (
          <li key={itemKey} className="flex gap-2">
            {item.checked === null ? (
              <span aria-hidden="true" className="mt-[0.1em] shrink-0">
                •
              </span>
            ) : (
              <>
                <span className="sr-only">
                  {item.checked ? "Done: " : "Not done: "}
                </span>
                <Checkbox checked={item.checked} />
              </>
            )}
            <span className="min-w-0 flex-1">{body}</span>
          </li>
        );
      })}
    </List>
  );
}

export function TaskMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content || !content.trim()) return null;

  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.trim().startsWith("```")) {
      const key = `code-${i}`;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <pre key={key}>
          <code>{codeLines.join("\n")}</code>
        </pre>,
      );
      i++;
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    if (RULE.test(line.trim())) {
      elements.push(<hr key={`hr-${i}`} />);
      i++;
      continue;
    }

    // Headings. The card title is an h3, so details start at h4 and the
    // deeper levels shrink rather than turning into an uppercase label.
    const heading = HEADING.exec(line);
    if (heading !== null) {
      const key = `h-${i}`;
      const inline = renderInline(heading[2], `${key}-`);
      const level = heading[1].length;
      elements.push(
        level <= 1 ? (
          <h4 key={key}>{inline}</h4>
        ) : level === 2 ? (
          <h5 key={key}>{inline}</h5>
        ) : (
          <h6 key={key}>{inline}</h6>
        ),
      );
      i++;
      continue;
    }

    if (line.startsWith(">")) {
      const key = `quote-${i}`;
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={key}>
          {quoteLines.map((quoted, index) => (
            <p key={`${key}-${index}`}>
              {renderInline(quoted, `${key}-${index}-`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    const listStart = LIST_ITEM.exec(line);
    if (listStart !== null) {
      const key = `list-${i}`;
      const [node, next] = parseList(lines, i, listStart[1].length);
      elements.push(renderList(node, key));
      i = next;
      continue;
    }

    // Paragraph: consecutive lines until the next block-level construct.
    const key = `p-${i}`;
    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith("```") &&
      !RULE.test(lines[i].trim()) &&
      !HEADING.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !LIST_ITEM.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    elements.push(
      <p key={key}>
        {paragraphLines.map((text, index) => (
          <Fragment key={`${key}-${index}`}>
            {renderInline(text, `${key}-${index}-`)}
            {index < paragraphLines.length - 1 ? <br /> : null}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={cn("prose-task", className)}>{elements}</div>;
}

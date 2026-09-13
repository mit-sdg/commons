import { Buffer } from "node:buffer";
import { describe, expect, test } from "vite-plus/test";
import { mailDocument, mailMarkdown, mailParagraphs } from "../../src/presentation/mail.ts";
import {
  taskListMailHtml,
  taskListMailText,
  taskMailHtml,
  taskMailSubject,
  taskMailText,
} from "../../src/computations/mail-content.ts";
import { passwordResetMailHtml } from "../../src/computations/password-reset.ts";
import { configuredPublicOrigin } from "../../src/deployment.ts";

const BASE = "https://commons.example.edu/groups/group?view=tasks";
const task = {
  kind: "task-assigned",
  taskTitle: "Draft the brief",
  listTitle: "Launch plan",
  deadline: "Fri, Sep 18, 2026, 5:00 PM EDT",
  actor: "",
  details: "Bring **two pages**.\n\n- A summary\n- A recommendation",
  list: "group/one",
  task: "task#two",
};

describe("the shared email document", () => {
  test("all metadata stays text and the document works without remote assets or a stylesheet", () => {
    const html = mailDocument({
      title: '<script>alert("title")</script>',
      event: "New <event>",
      facts: [
        ["From", "Ada <img src=x>"],
        ["Due", ""],
      ],
      action: { label: "Open <discussion>", url: 'https://example.edu/?q="1"&x=2' },
    });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain("max-width:600px");
    expect(html).toContain("<h1 style=");
    expect(html).toContain("&lt;script&gt;alert(&quot;title&quot;)&lt;/script&gt;");
    expect(html).toContain("Ada &lt;img src=x&gt;");
    expect(html).not.toMatch(/<(?:script|img|link|style)\b/);
    expect(html).not.toContain("Due:");
    expect(html).toContain('href="https://example.edu/?q=&quot;1&quot;&amp;x=2"');
    expect(html).toContain("Open &lt;discussion&gt;");
  });

  test("password resets use the shared presentation without losing credentials or safety wording", () => {
    const html = passwordResetMailHtml({
      voucher: "v/#",
      credential: "<secret>",
      username: "ada<test>",
    });
    expect(html).toContain('role="presentation"');
    expect(html).toContain("Account: <strong>ada&lt;test&gt;</strong>");
    expect(html).toMatch(/Reset code: <strong[^>]*>&lt;secret&gt;<\/strong>/);
    expect(html.indexOf("Reset code:")).toBeGreaterThan(html.indexOf("Someone asked"));
    expect(html).toContain("voucher=v%2F%23");
    expect(html).toContain("expires in one hour");
    expect(html).toContain("your password is unchanged");
  });
});

describe("authored messages in HTML mail", () => {
  test("Markdown renders headings, emphasis, quotes, nested lists, code, tables and inert checklists", () => {
    const html = mailMarkdown(
      '## Plan\n\nBring **two pages** and *one idea*.\nNext line.\n\n> A short quote.\n\n- First\n  - Nested\n- [x] Ready\n- [ ] Pending\n\n```ts\nconst x = "<safe>";\n```\n\n| Item | Count |\n| --- | --- |\n| Pages | 2 |',
      BASE,
    );
    expect(html).toMatch(/<h3[^>]*>Plan<\/h3>/);
    expect(html).toContain("<strong>two pages</strong>");
    expect(html).toContain("<em>one idea</em>");
    expect(html).toMatch(/<br\s*\/?>\s*Next line/);
    expect(html).toContain("<blockquote");
    expect(html.match(/<ul\b/g)).toHaveLength(2);
    expect(html).toContain("☑ Ready");
    expect(html).toContain("☐ Pending");
    expect(html).not.toContain("<input");
    expect(html).toContain("<pre");
    expect(html).toContain("&lt;safe&gt;");
    expect(html).toContain("<table");
    expect(html).toContain("white-space:pre-wrap");
  });

  test("links become absolute, unsafe protocols are removed, and images cannot load remotely", () => {
    const html = mailMarkdown(
      '[Course](/assignments/a#part) [Mail](mailto:ada@example.edu) [bad](javascript:alert%281%29) [data](data:text/html,bad) ![Figure](https://images.example.edu/figure.png)\n\n<script>alert(1)</script><img src="https://tracker.example.edu/pixel" onerror="bad()">',
      BASE,
    );
    expect(html).toContain('href="https://commons.example.edu/assignments/a#part"');
    expect(html).toContain('href="mailto:ada@example.edu"');
    expect(html).toContain('href="https://images.example.edu/figure.png"');
    expect(html).toContain("Figure</a>");
    expect(html).not.toMatch(/href="(?:javascript|data):/);
    expect(html).not.toMatch(/<(?:script|img|iframe|form|input)\b/);
    expect(html).toContain("&lt;script&gt;");
  });

  test("authored CSS and raw HTML remain literal, and invitation copy remains plain text", () => {
    const html = mailMarkdown(
      '<a href="javascript:alert(1)" style="position:fixed">raw</a>\n\n**Visible**',
      BASE,
    );
    expect(html).toContain("&lt;a href=");
    expect(html).toContain("<strong>Visible</strong>");
    expect(html).not.toContain('<a href="javascript:');
    const plain = mailParagraphs("Hello **class**\nNext line\n\n<img src=x>");
    expect(plain).toContain("Hello **class**<br>Next line");
    expect(plain).not.toContain("<strong>class</strong>");
    expect(plain).toContain("&lt;img src=x&gt;");
    expect(mailParagraphs(" \n ")).toBe("");
    expect(mailMarkdown(" \n ", BASE)).toBe("");
  });

  test("style-heavy messages remain bounded with a separate notice and the action still last", () => {
    const body = mailMarkdown("**word**\n\n".repeat(2_000) + "TAIL-MARKER", BASE);
    expect(Buffer.byteLength(body, "utf8")).toBeLessThan(70_000);
    expect(body).toContain("Shortened for email. Open it in Commons to read the rest.");
    expect(body).not.toContain("TAIL-MARKER");
    const html = mailDocument({
      title: "Large message",
      bodyHtml: body,
      action: { label: "Open discussion", url: BASE },
    });
    expect(Buffer.byteLength(html, "utf8")).toBeLessThan(80_000);
    expect(html.indexOf("Open discussion</a>")).toBeGreaterThan(
      html.indexOf("Shortened for email"),
    );
  });
});

describe("task and membership destinations", () => {
  test("both task alternatives name and open the specific task with encoded identities", () => {
    const url = `${configuredPublicOrigin()}/groups/group%2Fone?view=tasks&task=task%23two`;
    const text = taskMailText(task);
    const html = taskMailHtml(task);
    expect(text.endsWith(`Open task:\n${url}`)).toBe(true);
    expect(text).toContain(task.details);
    expect(html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
    expect(html).toContain("Open task</a>");
    expect(html).toContain("<strong>two pages</strong>");
    expect(html).toContain("Due: <strong>Fri, Sep 18, 2026, 5:00 PM EDT</strong>");
  });

  test("a member opens the group, and a removed member gets the usable groups destination", () => {
    const membership = {
      kind: "task-list-added",
      listTitle: "Study <group>",
      actor: "Ada <admin>",
      list: "group/one",
      member: true,
    };
    expect(taskListMailText(membership)).toContain("/groups/group%2Fone?view=members");
    expect(taskListMailHtml(membership)).toContain("Open group</a>");
    expect(taskListMailHtml(membership)).toContain("By: <strong>Ada &lt;admin&gt;</strong>");
    for (const kind of ["task-list-added", "task-list-removed"]) {
      const input = { ...membership, kind, member: false };
      expect(
        taskListMailText(input).endsWith(`Open groups:\n${configuredPublicOrigin()}/groups`),
      ).toBe(true);
      expect(taskListMailHtml(input)).not.toContain("/groups/group%2Fone");
    }
  });

  test("uncanceling uses human wording, subjects are bounded, and absent facts render nothing", () => {
    const input = { ...task, kind: "task-uncanceled", deadline: "", details: "" };
    for (const output of [taskMailSubject(input), taskMailText(input), taskMailHtml(input)]) {
      expect(output).toContain("is no longer canceled");
      expect(output).not.toContain("uncanceled");
    }
    expect(taskMailHtml(input)).not.toContain("Due:");
    expect(taskMailHtml(input)).not.toContain("By:");
    expect(
      taskMailSubject({
        ...task,
        taskTitle: "Title\r\nBcc: other@example.edu",
        listTitle: "g".repeat(10_000),
      }),
    ).not.toMatch(/[\r\n]/);
    expect(
      taskMailSubject({ ...task, taskTitle: "t".repeat(10_000), listTitle: "g".repeat(10_000) })
        .length,
    ).toBeLessThan(320);
  });
});

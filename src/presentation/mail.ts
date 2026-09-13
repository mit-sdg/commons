import { Buffer } from "node:buffer";
import { Marked } from "marked";
import sanitizeHtml from "sanitize-html";

export const escapeMailHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const LINK_STYLE =
  "color:#a34412;text-decoration:underline;overflow-wrap:anywhere;word-break:break-word;";
const PARAGRAPH_STYLE = "margin:0 0 16px;";
const PROSE_STYLES: Readonly<Record<string, string>> = {
  p: PARAGRAPH_STYLE,
  a: LINK_STYLE,
  h2: "margin:24px 0 12px;font-size:20px;line-height:1.35;",
  h3: "margin:20px 0 10px;font-size:18px;line-height:1.4;",
  h4: "margin:20px 0 10px;font-size:16px;line-height:1.4;",
  h5: "margin:20px 0 10px;font-size:16px;line-height:1.4;",
  h6: "margin:20px 0 10px;font-size:16px;line-height:1.4;",
  ul: "margin:0 0 16px;padding-left:24px;",
  ol: "margin:0 0 16px;padding-left:24px;",
  li: "margin:0 0 6px;",
  blockquote: "margin:16px 0;padding:0 0 0 16px;border-left:3px solid #d6d3d1;color:#57534e;",
  code: "font-family:Consolas,Menlo,monospace;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;",
  pre: "margin:16px 0;padding:14px;background-color:#f5f4f1;border:1px solid #e7e5e4;border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;",
  table: "width:100%;table-layout:fixed;border-collapse:collapse;margin:16px 0;font-size:14px;",
  th: "padding:8px;border:1px solid #d6d3d1;text-align:left;background-color:#f5f4f1;overflow-wrap:anywhere;word-break:break-word;",
  td: "padding:8px;border:1px solid #d6d3d1;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;",
  hr: "margin:24px 0;border:0;border-top:1px solid #e7e5e4;",
};

/** Email has no relative document URL. Only clickable, non-executable destinations survive. */
function absoluteLink(href: string, baseUrl: string): string {
  try {
    const url = new URL(href, baseUrl);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function markdown(source: string, baseUrl: string): string {
  const parser = new Marked({
    gfm: true,
    breaks: true,
    renderer: {
      // Authored HTML stays literal. It cannot supply styling, controls, or tracking pixels.
      html: ({ text }) => escapeMailHtml(text),
      image: ({ href, text }) =>
        `<a href="${escapeMailHtml(href)}">${escapeMailHtml(text || "View image")}</a>`,
      checkbox: ({ checked }) => (checked ? "☑ " : "☐ "),
      heading({ depth, tokens }) {
        const level = Math.min(depth + 1, 6);
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>`;
      },
    },
  });
  return sanitizeHtml(parser.parse(source, { async: false }), {
    allowedTags: [
      "p",
      "br",
      "span",
      "strong",
      "em",
      "del",
      "s",
      "a",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "hr",
    ],
    allowedAttributes: { "*": ["style"], a: ["href", "style"], ol: ["start", "style"] },
    allowedSchemes: ["https", "http", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      "*": (tagName, attributes) => {
        const attribs: Record<string, string> = {};
        if (PROSE_STYLES[tagName]) attribs.style = PROSE_STYLES[tagName];
        if (tagName === "a") {
          const href = attributes.href ? absoluteLink(attributes.href, baseUrl) : "";
          if (!href) return { tagName: "span", attribs: {} };
          attribs.href = href;
        }
        if (tagName === "ol" && /^\d+$/.test(attributes.start ?? ""))
          attribs.start = attributes.start;
        return { tagName, attribs };
      },
    },
  });
}

function paragraphs(source: string): string {
  return source
    .split(/\n\n+/)
    .map(
      (paragraph) =>
        `<p style="${PARAGRAPH_STYLE}">${escapeMailHtml(paragraph).replaceAll("\n", "<br>")}</p>`,
    )
    .join("");
}

// Inline styles and escaped characters can amplify a short source. Keep the body below
// common mail-client clipping thresholds so the action after it remains reachable.
const PROSE_BYTE_LIMIT = 70_000;
const SHORTENED = "Shortened for email. Open it in Commons to read the rest.";
function boundedProse(text: string, render: (source: string) => string): string {
  const source = text.replace(/\r\n?/g, "\n").trim();
  if (!source) return "";
  const html = render(source);
  if (Buffer.byteLength(html, "utf8") <= PROSE_BYTE_LIMIT) return html;
  let low = 0;
  let high = source.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (Buffer.byteLength(render(source.slice(0, middle)), "utf8") <= PROSE_BYTE_LIMIT - 1_000)
      low = middle;
    else high = middle - 1;
  }
  const prefix = source.slice(0, low);
  const lastBreak = prefix.search(/\s\S*$/);
  let kept = (lastBreak < 0 ? prefix : prefix.slice(0, lastBreak)).trimEnd();
  let clipped = render(`${kept}…`);
  // Markdown byte size is not monotonic: losing a fence can change the parsed blocks.
  // Recheck the final word cut rather than trusting the prefix search as a hard bound.
  while (Buffer.byteLength(clipped, "utf8") > PROSE_BYTE_LIMIT - 1_000 && kept.length > 0) {
    const shorter = kept.slice(0, Math.floor(kept.length / 2));
    const boundary = shorter.search(/\s\S*$/);
    kept = (boundary < 0 ? shorter : shorter.slice(0, boundary)).trimEnd();
    clipped = render(`${kept}…`);
  }
  // Render the notice separately: an unfinished code fence must not swallow the footer.
  return clipped + paragraphs(SHORTENED);
}

/** Forum messages and task details use Markdown, with inert authored HTML and absolute links. */
export function mailMarkdown(text: string, baseUrl: string): string {
  return boundedProse(text, (source) => markdown(source, baseUrl));
}

/** Invitation wording is deliberately plain text, not Markdown or HTML. */
export function mailParagraphs(text: string): string {
  return boundedProse(text, paragraphs);
}

/** Credentials belong after the explanatory copy, close to the action that needs them. */
export function mailCredential(label: string, value: string): string {
  return `<p style="margin:20px 0 0;font-size:14px;color:#57534e;">${escapeMailHtml(label)}: <strong style="font-family:Consolas,Menlo,monospace;font-size:16px;color:#292524;overflow-wrap:anywhere;">${escapeMailHtml(value)}</strong></p>`;
}

interface MailDocument {
  title: string;
  event?: string;
  facts?: readonly (readonly [label: string, value: string])[];
  /** Only application-rendered, escaped/sanitized prose belongs here. */
  bodyHtml?: string;
  action: { label: string; url: string };
  note?: string;
}

/** A quiet, image-free transactional email. Essential presentation uses inline email-safe CSS. */
export function mailDocument({
  title,
  event = "",
  facts = [],
  bodyHtml = "",
  action,
  note = "",
}: MailDocument): string {
  const heading = escapeMailHtml(title);
  const context = event
    ? `<p style="margin:0 0 10px;font-size:14px;line-height:1.5;color:#57534e;">${escapeMailHtml(event)}</p>`
    : "";
  const metadata = facts
    .filter(([, value]) => value.trim() !== "")
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 5px;font-size:14px;line-height:1.5;color:#57534e;">${escapeMailHtml(label)}: <strong>${escapeMailHtml(value)}</strong></p>`,
    )
    .join("");
  const message = bodyHtml ? `<div style="margin-top:24px;">${bodyHtml}</div>` : "";
  const notice = note
    ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#57534e;">${escapeMailHtml(note)}</p>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;background-color:#f8f7f4;color:#292524;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:#f8f7f4;"><tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;table-layout:fixed;"><tr><td style="padding:0 12px 16px;font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#292524;">Commons</td></tr>
<tr><td style="padding:28px 24px;background-color:#ffffff;border:1px solid #e7e5e4;border-radius:10px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#292524;overflow-wrap:anywhere;word-break:break-word;">
${context}<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:26px;line-height:1.3;font-weight:bold;color:#292524;">${heading}</h1>${metadata}${message}${notice}
<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #e7e5e4;"><a href="${escapeMailHtml(action.url)}" style="${LINK_STYLE}font-weight:bold;">${escapeMailHtml(action.label)}</a></p>
</td></tr></table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

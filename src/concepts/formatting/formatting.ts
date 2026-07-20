import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

function linkMentions(source: string): string {
  const segments = source.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return segments
    .map((segment, i) => {
      if (i % 2 === 1) return segment;
      return segment.replace(/(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]+)\b/g, "[@$1](/u/$1)");
    })
    .join("");
}

function render(source: string): string {
  const html = marked.parse(linkMentions(source), { async: false }) as string;
  return sanitizeHtml(html);
}

export class FormattingConcept {
  private readonly documents = new Map<string, { source: string; rendered: string }>();

  setSource({ target, source }: { target: string; source: string }) {
    const rendered = render(source);
    this.documents.set(target, { source, rendered });
    return { target, rendered };
  }

  clear({ target }: { target: string }) {
    this.documents.delete(target);
    return { target };
  }

  _getRendered({ target }: { target: string }): { rendered: string }[] {
    const doc = this.documents.get(target);
    return doc === undefined ? [] : [{ rendered: doc.rendered }];
  }
}

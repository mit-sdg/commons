import { marked } from "marked";
import type { Collection, Db } from "mongodb";
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

interface DocumentDoc {
  _id: string;
  source: string;
  rendered: string;
}

export class MongoFormattingConcept {
  private readonly documents: Collection<DocumentDoc>;

  constructor(db: Db) {
    this.documents = db.collection<DocumentDoc>("formatting.documents");
  }

  async setSource({ target, source }: { target: string; source: string }) {
    const rendered = render(source);
    await this.documents.updateOne(
      { _id: target },
      { $set: { source, rendered } },
      { upsert: true },
    );
    return { target, rendered };
  }

  async clear({ target }: { target: string }) {
    await this.documents.deleteOne({ _id: target });
    return { target };
  }

  async _getRendered({ target }: { target: string }) {
    const doc = await this.documents.findOne({ _id: target });
    return doc === null ? [] : [{ rendered: doc.rendered }];
  }
}

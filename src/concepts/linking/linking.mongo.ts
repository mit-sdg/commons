import type { Collection, Db } from "mongodb";

interface LinkDoc {
  _id: string;
  targets: string[];
  seq: number;
}

export class MongoLinkingConcept {
  private readonly links: Collection<LinkDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;

  constructor(db: Db, instance = "Linking") {
    const prefix = `${instance[0]?.toLowerCase() ?? ""}${instance.slice(1)}`;
    this.links = db.collection<LinkDoc>(`${prefix}.links`);
    this.counters = db.collection(`${prefix}.counters`);
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "links" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async setLinks({ source, targets }: { source: string; targets: string[] }) {
    const existing = await this.links.findOne({ _id: source });
    if (existing === null) {
      await this.links.insertOne({
        _id: source,
        targets: [...targets],
        seq: await this.#nextSeq(),
      });
    } else {
      await this.links.updateOne({ _id: source }, { $set: { targets: [...targets] } });
    }
    return { source };
  }

  async setLinksFrom({ source, content }: { source: string; content: string }) {
    const targets = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]);
    return this.setLinks({ source, targets });
  }

  async clearLinks({ source }: { source: string }) {
    await this.links.deleteOne({ _id: source });
    return { source };
  }

  async clearBacklinks({ target }: { target: string }) {
    await this.links.updateMany({ targets: target }, { $pull: { targets: target } });
    return { target };
  }

  async _getLinks({ source }: { source: string }) {
    const doc = await this.links.findOne({ _id: source });
    return (doc?.targets ?? []).map((target) => ({ target }));
  }

  async _getBacklinks({ target }: { target: string }) {
    const docs = await this.links.find({ targets: target }).sort({ seq: 1 }).toArray();
    return docs.map((doc) => ({ source: doc._id }));
  }
}

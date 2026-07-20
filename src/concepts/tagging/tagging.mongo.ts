import { TaggingConcept } from "./tagging.ts";
import type { Collection, Db } from "mongodb";
import { TagAlreadyApplied, TagAlreadyExists, TagNotApplied, TagNotFound } from "./errors.ts";

interface TagDoc {
  _id: string;
  name: string;
}

interface TargetDoc {
  _id: string;
  tags: string[];
}

export class MongoTaggingConcept {
  static readonly queries = TaggingConcept.queries;

  private readonly tags: Collection<TagDoc>;
  private readonly targets: Collection<TargetDoc>;

  constructor(db: Db) {
    this.tags = db.collection<TagDoc>("tagging.tags");
    this.targets = db.collection<TargetDoc>("tagging.targets");
  }

  async createTag({ name }: { name: string }) {
    const clash = await this.tags.findOne({ name });
    if (clash !== null) throw new TagAlreadyExists(name);
    const tag = crypto.randomUUID();
    await this.tags.insertOne({ _id: tag, name });
    return { tag };
  }

  async addTag({ target, tag }: { target: string; tag: string }) {
    const known = await this.tags.findOne({ _id: tag });
    if (known === null) {
      throw new TagNotFound(tag);
    }
    const doc = await this.targets.findOne({ _id: target });
    const applied = doc?.tags ?? [];
    if (applied.includes(tag)) {
      throw new TagAlreadyApplied(tag);
    }
    await this.targets.updateOne(
      { _id: target },
      { $set: { tags: [...applied, tag] } },
      { upsert: true },
    );
    return { target };
  }

  async removeTag({ target, tag }: { target: string; tag: string }) {
    const doc = await this.targets.findOne({ _id: target });
    if (doc === null || !doc.tags.includes(tag)) {
      throw new TagNotApplied(tag);
    }
    const remaining = doc.tags.filter((t) => t !== tag);
    if (remaining.length === 0) await this.targets.deleteOne({ _id: target });
    else await this.targets.updateOne({ _id: target }, { $set: { tags: remaining } });
    return { target };
  }

  async deleteTag({ tag }: { tag: string }) {
    const removed = await this.tags.deleteOne({ _id: tag });
    if (removed.deletedCount === 0) {
      throw new TagNotFound(tag);
    }
    await this.targets.updateMany({ tags: tag }, { $pull: { tags: tag } });
    await this.targets.deleteMany({ tags: { $size: 0 } });
    return { tag };
  }

  async clearTarget({ target }: { target: string }) {
    await this.targets.deleteOne({ _id: target });
    return { target };
  }

  async _getTags({ target }: { target: string }) {
    const doc = await this.targets.findOne({ _id: target });
    if (doc === null) return [];
    const tagDocs = await this.tags.find({ _id: { $in: doc.tags } }).toArray();
    const byId = new Map(tagDocs.map((t) => [t._id, t.name]));
    return doc.tags.flatMap((tag) => {
      const name = byId.get(tag);
      return name === undefined ? [] : [{ tag, name }];
    });
  }

  async _getTargets({ tag }: { tag: string }) {
    const docs = await this.targets.find({ tags: tag }).toArray();
    return docs.map((doc) => ({ target: doc._id }));
  }

  async _getByName({ name }: { name: string }) {
    const doc = await this.tags.findOne({ name });
    return doc === null ? [] : [{ tag: doc._id }];
  }

  async _getAllTags(_: Record<string, never>) {
    const docs = await this.tags.find({}).toArray();
    return docs.map((doc) => ({ tag: doc._id, name: doc.name }));
  }
}

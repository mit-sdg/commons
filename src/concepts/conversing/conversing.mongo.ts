import type { Collection, Db } from "mongodb";
import { speedIndexes } from "../indexes.ts";
import {
  ConversationNotFound,
  ItemAlreadyInConversation,
  NodeHasChildren,
  NodeNotFound,
  ParentNodeNotFound,
} from "./errors.ts";

interface ConversationDoc {
  _id: string;
  root: string;
  createdAt: Date;
  seq: number;
}

interface NodeDoc {
  _id: string;
  conversation: string;
  item: string;
  parent: string | null;
  depth: number;
  createdAt: Date;
  seq: number;
}

interface ConversationRow {
  conversation: string;
  root: string;
  item: string;
  createdAt: Date;
  lastActivityAt: Date;
}

const toRow = (row: ConversationRow & { seqOf: number; lastSeq: number }): ConversationRow => ({
  conversation: row.conversation,
  root: row.root,
  item: row.item,
  createdAt: row.createdAt,
  lastActivityAt: row.lastActivityAt,
});

export class MongoConversingConcept {
  private readonly conversations: Collection<ConversationDoc>;
  private readonly nodes: Collection<NodeDoc>;
  private readonly counters: Collection<{ _id: string; value: number }>;
  readonly #ready: () => Promise<void>;

  constructor(db: Db) {
    this.conversations = db.collection<ConversationDoc>("conversing.conversations");
    this.nodes = db.collection<NodeDoc>("conversing.nodes");
    this.counters = db.collection("conversing.counters");
    this.#ready = speedIndexes("Conversing", () =>
      this.nodes.createIndexes([
        { key: { item: 1 } },
        { key: { conversation: 1, createdAt: 1, seq: 1 } },
        { key: { parent: 1 } },
      ]),
    );
  }

  async #nextSeq(): Promise<number> {
    const counter = await this.counters.findOneAndUpdate(
      { _id: "seq" },
      { $inc: { value: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return counter?.value ?? 0;
  }

  async start({ item, at }: { item: string; at: Date }) {
    await this.#ready();
    if ((await this.#placementOf(item)) !== undefined) {
      throw new ItemAlreadyInConversation(`Item ${item} is already placed in a conversation`);
    }
    const conversation = crypto.randomUUID();
    const node = crypto.randomUUID();
    const seq = await this.#nextSeq();
    await this.nodes.insertOne({
      _id: node,
      conversation,
      item,
      parent: null,
      depth: 0,
      createdAt: at,
      seq,
    });
    await this.conversations.insertOne({ _id: conversation, root: node, createdAt: at, seq });
    return { conversation, node };
  }

  async reply({ item, parent, at }: { item: string; parent: string; at: Date }) {
    await this.#ready();
    const parentDoc = await this.nodes.findOne({ _id: parent });
    if (parentDoc === null) {
      throw new ParentNodeNotFound(`No node named ${parent}`);
    }
    if ((await this.#placementOf(item)) !== undefined) {
      throw new ItemAlreadyInConversation(`Item ${item} is already placed in a conversation`);
    }
    const node = crypto.randomUUID();
    await this.nodes.insertOne({
      _id: node,
      conversation: parentDoc.conversation,
      item,
      parent,
      depth: parentDoc.depth + 1,
      createdAt: at,
      seq: await this.#nextSeq(),
    });
    return { node };
  }

  /** Whether each conversation exists, in the order given, from one read. */
  async _exists(inputs: readonly { conversation: string }[]) {
    const ids = [...new Set(inputs.map(({ conversation }) => conversation))];
    if (ids.length === 0) return [];
    const docs = await this.conversations
      .find({ _id: { $in: ids } }, { projection: { _id: 1 } })
      .toArray();
    const found = new Set(docs.map((doc) => doc._id));
    return inputs.map(({ conversation }) => ({ exists: found.has(conversation) }));
  }

  async _getThread({ conversation }: { conversation: string }) {
    await this.#ready();
    const docs = await this.nodes.find({ conversation }).sort({ createdAt: 1, seq: 1 }).toArray();
    return docs.map((doc) => ({
      node: doc._id,
      item: doc.item,
      parent: doc.parent,
      depth: doc.depth,
    }));
  }

  async _getRoot({ conversation }: { conversation: string }) {
    await this.#ready();
    const doc = await this.conversations.findOne({ _id: conversation });
    if (doc === null) return [];
    const root = await this.nodes.findOne({ _id: doc.root });
    return root === null ? [] : [{ item: root.item }];
  }

  /** The conversation holding each node, in the order given, from one read. */
  async _getConversation(inputs: readonly { node: string }[]) {
    const ids = [...new Set(inputs.map(({ node }) => node))];
    if (ids.length === 0) return [];
    await this.#ready();
    const docs = await this.nodes
      .find({ _id: { $in: ids } }, { projection: { _id: 1, conversation: 1 } })
      .toArray();
    const conversationOf = new Map(docs.map((doc) => [doc._id, doc.conversation]));
    return inputs.map(({ node }) => {
      const conversation = conversationOf.get(node);
      return conversation === undefined ? [] : [{ conversation }];
    });
  }

  async remove({ node }: { node: string }) {
    await this.#ready();
    const doc = await this.nodes.findOne({ _id: node });
    if (doc === null) {
      throw new NodeNotFound(`No node named ${node}`);
    }
    if ((await this.nodes.countDocuments({ parent: node })) > 0) {
      throw new NodeHasChildren(`Node ${node} has replies beneath it`);
    }
    await this.nodes.deleteOne({ _id: node });
    const remaining = await this.nodes.countDocuments({ conversation: doc.conversation });
    if (remaining === 0) await this.conversations.deleteOne({ _id: doc.conversation });
    return { node };
  }

  async dissolve({ conversation }: { conversation: string }) {
    await this.#ready();
    const doc = await this.conversations.findOne({ _id: conversation }, { projection: { _id: 1 } });
    if (doc === null) {
      throw new ConversationNotFound(`No conversation named ${conversation}`);
    }
    await this.nodes.deleteMany({ conversation });
    await this.conversations.deleteOne({ _id: conversation });
    return { conversation };
  }

  /**
   * The node placing each item, in the order given, from one read. Should an item have several,
   * the first the read returns answers, as `findOne` chose in the single form.
   */
  async _getNodeByItem(inputs: readonly { item: string }[]) {
    const items = [...new Set(inputs.map(({ item }) => item))];
    if (items.length === 0) return [];
    await this.#ready();
    const docs = await this.nodes
      .find({ item: { $in: items } }, { projection: { _id: 1, item: 1 } })
      .toArray();
    const nodeOf = new Map<string, string>();
    for (const doc of docs) if (!nodeOf.has(doc.item)) nodeOf.set(doc.item, doc._id);
    return inputs.map(({ item }) => {
      const node = nodeOf.get(item);
      return node === undefined ? [] : [{ node }];
    });
  }

  async _parentOf({ node }: { node: string }) {
    await this.#ready();
    const doc = await this.nodes.findOne({ _id: node });
    return doc === null || doc.parent === null ? [] : [{ parent: doc.parent }];
  }

  async _getItem({ node }: { node: string }) {
    await this.#ready();
    const doc = await this.nodes.findOne({ _id: node });
    return doc === null ? [] : [{ item: doc.item }];
  }

  async _hasChildren({ node }: { node: string }) {
    await this.#ready();
    const present = (await this.nodes.countDocuments({ parent: node })) > 0;
    return { present };
  }

  async _getConversations(_: Record<string, never>): Promise<ConversationRow[]> {
    const rows = await this.#conversationRows();
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.seqOf - a.seqOf)
      .map(toRow);
  }

  async _getConversationsByLastActivity(_: Record<string, never>): Promise<ConversationRow[]> {
    const rows = await this.#conversationRows();
    return rows
      .sort(
        (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || b.lastSeq - a.lastSeq,
      )
      .map(toRow);
  }

  async #placementOf(item: string): Promise<string | undefined> {
    await this.#ready();
    const doc = await this.nodes.findOne({ item });
    return doc === null ? undefined : doc._id;
  }

  async #conversationRows(): Promise<(ConversationRow & { seqOf: number; lastSeq: number })[]> {
    await this.#ready();
    const conversations = await this.conversations.find({}).toArray();
    const nodes = await this.nodes.find({}).toArray();
    const rows = new Map(
      conversations.map((doc) => [
        doc._id,
        {
          conversation: doc._id,
          root: doc.root,
          item: "",
          createdAt: doc.createdAt,
          lastActivityAt: doc.createdAt,
          seqOf: doc.seq,
          lastSeq: doc.seq,
        },
      ]),
    );
    for (const node of nodes) {
      const row = rows.get(node.conversation);
      if (row === undefined) continue;
      if (node.createdAt.getTime() > row.lastActivityAt.getTime())
        row.lastActivityAt = node.createdAt;
      if (node.seq > row.lastSeq) row.lastSeq = node.seq;
      if (node.parent === null) row.item = node.item;
    }
    return [...rows.values()];
  }

  async _threadNodes({ conversation }: { conversation: string }) {
    return { nodes: await this._getThread({ conversation }) };
  }
}

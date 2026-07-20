import type { Collection, Db } from "mongodb";
import {
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

  constructor(db: Db) {
    this.conversations = db.collection<ConversationDoc>("conversing.conversations");
    this.nodes = db.collection<NodeDoc>("conversing.nodes");
    this.counters = db.collection("conversing.counters");
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

  async _getThread({ conversation }: { conversation: string }) {
    const docs = await this.nodes.find({ conversation }).sort({ createdAt: 1, seq: 1 }).toArray();
    return docs.map((doc) => ({
      node: doc._id,
      item: doc.item,
      parent: doc.parent,
      depth: doc.depth,
    }));
  }

  async _getConversation({ node }: { node: string }) {
    const doc = await this.nodes.findOne({ _id: node });
    return doc === null ? [] : [{ conversation: doc.conversation }];
  }

  async remove({ node }: { node: string }) {
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

  async _getNodeByItem({ item }: { item: string }) {
    const node = await this.#placementOf(item);
    return node === undefined ? [] : [{ node }];
  }

  async _parentOf({ node }: { node: string }) {
    const doc = await this.nodes.findOne({ _id: node });
    return doc === null || doc.parent === null ? [] : [{ parent: doc.parent }];
  }

  async _getItem({ node }: { node: string }) {
    const doc = await this.nodes.findOne({ _id: node });
    return doc === null ? [] : [{ item: doc.item }];
  }

  async _hasChildren({ node }: { node: string }) {
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
    const doc = await this.nodes.findOne({ item });
    return doc === null ? undefined : doc._id;
  }

  async #conversationRows(): Promise<(ConversationRow & { seqOf: number; lastSeq: number })[]> {
    const conversations = await this.conversations.find({}).toArray();
    const nodes = await this.nodes.find({}).toArray();
    return conversations.map((doc) => {
      let lastActivityAt = doc.createdAt;
      let lastSeq = doc.seq;
      let item = "";
      for (const nodeDoc of nodes) {
        if (nodeDoc.conversation !== doc._id) continue;
        if (nodeDoc.createdAt.getTime() > lastActivityAt.getTime()) {
          lastActivityAt = nodeDoc.createdAt;
        }
        if (nodeDoc.seq > lastSeq) lastSeq = nodeDoc.seq;
        if (nodeDoc.parent === null) item = nodeDoc.item;
      }
      return {
        conversation: doc._id,
        root: doc.root,
        item,
        createdAt: doc.createdAt,
        lastActivityAt,
        seqOf: doc.seq,
        lastSeq,
      };
    });
  }
}

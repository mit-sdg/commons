import {
  ItemAlreadyInConversation,
  NodeHasChildren,
  NodeNotFound,
  ParentNodeNotFound,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface ConversationDoc {
  root: string;
  createdAt: Date;
  seq: number;
}

interface NodeDoc {
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

export class ConversingConcept {
  private readonly conversations = new Map<string, ConversationDoc>();
  private readonly nodes = new Map<string, NodeDoc>();
  private seq = 0;

  start({ item, at }: { item: string; at: Date }) {
    if (this.#placementOf(item) !== undefined) {
      throw new ItemAlreadyInConversation(`Item ${item} is already placed in a conversation`);
    }
    const conversation = freshID();
    const node = freshID();
    this.nodes.set(node, {
      conversation,
      item,
      parent: null,
      depth: 0,
      createdAt: at,
      seq: (this.seq += 1),
    });
    this.conversations.set(conversation, { root: node, createdAt: at, seq: this.seq });
    return { conversation, node };
  }

  reply({ item, parent, at }: { item: string; parent: string; at: Date }) {
    const parentDoc = this.nodes.get(parent);
    if (parentDoc === undefined) {
      throw new ParentNodeNotFound(`No node named ${parent}`);
    }
    if (this.#placementOf(item) !== undefined) {
      throw new ItemAlreadyInConversation(`Item ${item} is already placed in a conversation`);
    }
    const node = freshID();
    this.nodes.set(node, {
      conversation: parentDoc.conversation,
      item,
      parent,
      depth: parentDoc.depth + 1,
      createdAt: at,
      seq: (this.seq += 1),
    });
    return { node };
  }

  _getThread({ conversation }: { conversation: string }): {
    node: string;
    item: string;
    parent: string | null;
    depth: number;
  }[] {
    return [...this.nodes.entries()]
      .filter(([, doc]) => doc.conversation === conversation)
      .sort(([, a], [, b]) => a.createdAt.getTime() - b.createdAt.getTime() || a.seq - b.seq)
      .map(([node, doc]) => ({
        node,
        item: doc.item,
        parent: doc.parent,
        depth: doc.depth,
      }));
  }

  _getConversation({ node }: { node: string }): { conversation: string }[] {
    const doc = this.nodes.get(node);
    return doc === undefined ? [] : [{ conversation: doc.conversation }];
  }

  remove({ node }: { node: string }) {
    const doc = this.nodes.get(node);
    if (doc === undefined) {
      throw new NodeNotFound(`No node named ${node}`);
    }
    for (const other of this.nodes.values()) {
      if (other.parent === node) {
        throw new NodeHasChildren(`Node ${node} has replies beneath it`);
      }
    }
    this.nodes.delete(node);
    let remaining = false;
    for (const other of this.nodes.values()) {
      if (other.conversation === doc.conversation) {
        remaining = true;
        break;
      }
    }
    if (!remaining) this.conversations.delete(doc.conversation);
    return { node };
  }

  _getNodeByItem({ item }: { item: string }): { node: string }[] {
    const placement = this.#placementOf(item);
    return placement === undefined ? [] : [{ node: placement }];
  }

  _parentOf({ node }: { node: string }): { parent: string }[] {
    const doc = this.nodes.get(node);
    return doc === undefined || doc.parent === null ? [] : [{ parent: doc.parent }];
  }

  _getItem({ node }: { node: string }): { item: string }[] {
    const doc = this.nodes.get(node);
    return doc === undefined ? [] : [{ item: doc.item }];
  }

  _hasChildren({ node }: { node: string }): { present: boolean } {
    for (const doc of this.nodes.values()) {
      if (doc.parent === node) return { present: true };
    }
    return { present: false };
  }

  _getConversations(_: Record<string, never>): ConversationRow[] {
    return this.#conversationRows().sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.seqOf - a.seqOf,
    );
  }

  _getConversationsByLastActivity(_: Record<string, never>): ConversationRow[] {
    return this.#conversationRows().sort(
      (a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime() || b.lastSeq - a.lastSeq,
    );
  }

  #placementOf(item: string): string | undefined {
    for (const [node, doc] of this.nodes) if (doc.item === item) return node;
    return undefined;
  }

  #conversationRows(): (ConversationRow & { seqOf: number; lastSeq: number })[] {
    return [...this.conversations.entries()].map(([conversation, doc]) => {
      let lastActivityAt = doc.createdAt;
      let lastSeq = doc.seq;
      let item = "";
      for (const nodeDoc of this.nodes.values()) {
        if (nodeDoc.conversation !== conversation) continue;
        if (nodeDoc.createdAt.getTime() > lastActivityAt.getTime()) {
          lastActivityAt = nodeDoc.createdAt;
        }
        if (nodeDoc.seq > lastSeq) lastSeq = nodeDoc.seq;
        if (nodeDoc.parent === null) item = nodeDoc.item;
      }
      return {
        conversation,
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

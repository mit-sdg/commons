import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { ReactionAlreadyExists, ReactionNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface ReactionDoc {
  reactor: string;
  target: string;
  kind: string;
  reactedAt: Date;
}

export class ReactingConcept {
  static readonly queries = {
    _getReactionsForTarget: "many",
    _getReactionsByUser: "many",
    _countByKind: "many",
    _hasReacted: "one",
  } as const satisfies Record<string, QueryPromise>;

  private readonly reactions = new Map<string, ReactionDoc>();

  #findKey(reactor: string, target: string, kind: string): string | undefined {
    for (const [reaction, doc] of this.reactions) {
      if (doc.reactor === reactor && doc.target === target && doc.kind === kind) return reaction;
    }
    return undefined;
  }

  react({
    reactor,
    target,
    kind,
    at,
  }: {
    reactor: string;
    target: string;
    kind: string;
    at: Date;
  }) {
    if (this.#findKey(reactor, target, kind) !== undefined) {
      throw new ReactionAlreadyExists(`${reactor} ${kind} ${target}`);
    }
    const reaction = freshID();
    this.reactions.set(reaction, { reactor, target, kind, reactedAt: at });
    return { reaction };
  }

  unreact({ reactor, target, kind }: { reactor: string; target: string; kind: string }) {
    const reaction = this.#findKey(reactor, target, kind);
    if (reaction === undefined) {
      throw new ReactionNotFound(`${reactor} ${kind} ${target}`);
    }
    this.reactions.delete(reaction);
    return { reaction };
  }

  clearTarget({ target }: { target: string }) {
    for (const [reaction, doc] of this.reactions) {
      if (doc.target === target) this.reactions.delete(reaction);
    }
    return { target };
  }

  _getReactionsForTarget({
    target,
  }: {
    target: string;
  }): { reaction: string; reactor: string; kind: string }[] {
    const rows: { reaction: string; reactor: string; kind: string }[] = [];
    for (const [reaction, doc] of this.reactions) {
      if (doc.target === target) rows.push({ reaction, reactor: doc.reactor, kind: doc.kind });
    }
    return rows;
  }

  _getReactionsByUser({
    reactor,
  }: {
    reactor: string;
  }): { reaction: string; target: string; kind: string }[] {
    const rows: { reaction: string; target: string; kind: string }[] = [];
    for (const [reaction, doc] of this.reactions) {
      if (doc.reactor === reactor) rows.push({ reaction, target: doc.target, kind: doc.kind });
    }
    return rows;
  }

  _countByKind({ target }: { target: string }): { kind: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const doc of this.reactions.values()) {
      if (doc.target === target) counts.set(doc.kind, (counts.get(doc.kind) ?? 0) + 1);
    }
    return [...counts].map(([kind, count]) => ({ kind, count }));
  }

  _hasReacted({ reactor, target, kind }: { reactor: string; target: string; kind: string }): {
    hasReacted: boolean;
  } {
    return { hasReacted: this.#findKey(reactor, target, kind) !== undefined };
  }
}

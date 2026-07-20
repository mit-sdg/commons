import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { FlagAlreadyExists, FlagNotFound, OutcomeInvalid } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface FlagDoc {
  reporter: string;
  target: string;
  reason: string;
  createdAt: Date;
  status: "open" | "upheld" | "dismissed";
}

export class FlaggingConcept {
  static readonly queries = {
    _getOpenTargets: "many",
    _getFlags: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly flags = new Map<string, FlagDoc>();

  flag({
    reporter,
    target,
    reason,
    at,
  }: {
    reporter: string;
    target: string;
    reason: string;
    at: Date;
  }) {
    for (const doc of this.flags.values()) {
      if (doc.reporter === reporter && doc.target === target && doc.status === "open") {
        throw new FlagAlreadyExists(`${reporter} already has an open flag on ${target}`);
      }
    }
    const flag = freshID();
    this.flags.set(flag, { reporter, target, reason, createdAt: at, status: "open" });
    return { flag };
  }

  resolve({ target, outcome }: { target: string; outcome: string }) {
    if (outcome !== "upheld" && outcome !== "dismissed") {
      throw new OutcomeInvalid('Outcome must be "upheld" or "dismissed".');
    }
    let found = false;
    for (const doc of this.flags.values()) {
      if (doc.target === target && doc.status === "open") {
        doc.status = outcome;
        found = true;
      }
    }
    if (!found) {
      throw new FlagNotFound(`No open flag on ${target}`);
    }
    return { target };
  }

  clearTarget({ target }: { target: string }) {
    for (const [flag, doc] of this.flags) if (doc.target === target) this.flags.delete(flag);
    return { target };
  }

  _getOpenTargets(_: Record<string, never>): { target: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const doc of this.flags.values()) {
      if (doc.status === "open") counts.set(doc.target, (counts.get(doc.target) ?? 0) + 1);
    }
    return [...counts]
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => b.count - a.count);
  }

  _getFlags({ target }: { target: string }): {
    flag: string;
    reporter: string;
    reason: string;
    status: string;
    createdAt: Date;
  }[] {
    return [...this.flags.entries()]
      .filter(([, doc]) => doc.target === target)
      .map(([flag, doc]) => ({
        flag,
        reporter: doc.reporter,
        reason: doc.reason,
        status: doc.status,
        createdAt: doc.createdAt,
      }));
  }
}

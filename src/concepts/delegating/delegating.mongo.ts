import type { Collection, Db } from "mongodb";
import { DelegationNotFound, InvalidSpread } from "./errors.ts";

interface DelegationEntry {
  delegation: string;
  subject: string;
  delegate: string;
  seq: number;
}

interface ItemDelegationsDoc {
  _id: string;
  version: number;
  nextSeq: number;
  entries: DelegationEntry[];
}

const listed = (values: unknown): string[] | null => {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (values.some((value) => typeof value !== "string" || value === "")) return null;
  const names = values as string[];
  return new Set(names).size === names.length ? names : null;
};

/**
 * All delegations for one item live in one versioned document. Mutations use a
 * compare-and-swap loop, which gives a spread one atomic visibility boundary
 * even when separate application instances race on the same database.
 */
export class MongoDelegatingConcept {
  private readonly items: Collection<ItemDelegationsDoc>;

  constructor(db: Db) {
    this.items = db.collection<ItemDelegationsDoc>("delegating.items");
  }

  async #change<T>(
    item: string,
    decide: (current: ItemDelegationsDoc) => {
      entries: DelegationEntry[];
      nextSeq: number;
      answer: T;
    },
  ): Promise<T> {
    for (;;) {
      const existing = await this.items.findOne({ _id: item });
      const current: ItemDelegationsDoc = existing ?? {
        _id: item,
        version: 0,
        nextSeq: 1,
        entries: [],
      };
      const change = decide(current);
      if (existing === null) {
        try {
          await this.items.insertOne({
            _id: item,
            version: 1,
            nextSeq: change.nextSeq,
            entries: change.entries,
          });
          return change.answer;
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11_000
          ) {
            continue;
          }
          throw error;
        }
      }
      const replaced = await this.items.replaceOne(
        { _id: item, version: existing.version },
        {
          version: existing.version + 1,
          nextSeq: change.nextSeq,
          entries: change.entries,
        },
      );
      if (replaced.modifiedCount === 1) return change.answer;
    }
  }

  async delegate({ item, subject, delegate }: { item: string; subject: string; delegate: string }) {
    return this.#change(item, (current) => {
      const found = current.entries.find((entry) => entry.subject === subject);
      if (found !== undefined) {
        return {
          entries: current.entries.map((entry) =>
            entry.subject === subject ? { ...entry, delegate } : entry,
          ),
          nextSeq: current.nextSeq,
          answer: { delegation: found.delegation },
        };
      }
      const delegation = crypto.randomUUID();
      return {
        entries: [...current.entries, { delegation, subject, delegate, seq: current.nextSeq }],
        nextSeq: current.nextSeq + 1,
        answer: { delegation },
      };
    });
  }

  async withdraw({ item, subject }: { item: string; subject: string }) {
    return this.#change(item, (current) => {
      const found = current.entries.find((entry) => entry.subject === subject);
      if (found === undefined) throw new DelegationNotFound(`${item} ${subject}`);
      return {
        entries: current.entries.filter((entry) => entry.subject !== subject),
        nextSeq: current.nextSeq,
        answer: { delegation: found.delegation },
      };
    });
  }

  async spread({
    item,
    subjects,
    delegates,
    replace,
  }: {
    item: string;
    subjects: string[];
    delegates: string[];
    replace: boolean;
  }): Promise<{ assigned: { subject: string; delegate: string }[] }> {
    const targets = listed(subjects);
    const graders = listed(delegates);
    if (targets === null || graders === null || typeof replace !== "boolean") {
      throw new InvalidSpread("Choose at least one distinct subject and delegate.");
    }
    return this.#change(item, (current) => {
      const standingSubjects = new Set(current.entries.map((entry) => entry.subject));
      const selected = replace
        ? targets
        : targets.filter((subject) => !standingSubjects.has(subject));
      const targetSet = new Set(selected);
      const load = new Map(graders.map((delegate) => [delegate, 0]));
      for (const entry of current.entries) {
        if (targetSet.has(entry.subject)) continue;
        const held = load.get(entry.delegate);
        if (held !== undefined) load.set(entry.delegate, held + 1);
      }

      let nextSeq = current.nextSeq;
      const replacements = new Map<string, string>();
      const assigned: { subject: string; delegate: string }[] = [];
      for (const subject of selected) {
        let chosen = graders[0] as string;
        for (const grader of graders) {
          if ((load.get(grader) as number) < (load.get(chosen) as number)) chosen = grader;
        }
        load.set(chosen, (load.get(chosen) as number) + 1);
        replacements.set(subject, chosen);
        assigned.push({ subject, delegate: chosen });
      }

      const entries = current.entries.map((entry) => {
        const delegate = replacements.get(entry.subject);
        if (delegate === undefined) return entry;
        replacements.delete(entry.subject);
        return { ...entry, delegate };
      });
      for (const [subject, delegate] of replacements) {
        entries.push({
          delegation: crypto.randomUUID(),
          subject,
          delegate,
          seq: nextSeq,
        });
        nextSeq += 1;
      }
      return { entries, nextSeq, answer: { assigned } };
    });
  }

  async clearItem({ item }: { item: string }) {
    return this.#change(item, (current) => ({
      entries: [],
      nextSeq: current.nextSeq,
      answer: { cleared: current.entries.length },
    }));
  }

  async _getDelegations({ item }: { item: string }) {
    const doc = await this.items.findOne({ _id: item });
    return (doc?.entries ?? [])
      .toSorted((left, right) => left.seq - right.seq)
      .map(({ delegation, subject, delegate }) => ({ delegation, subject, delegate }));
  }

  async _getDelegation({ item, subject }: { item: string; subject: string }) {
    const doc = await this.items.findOne({ _id: item });
    const entry = doc?.entries.find((candidate) => candidate.subject === subject);
    return entry === undefined ? [] : [{ delegation: entry.delegation, delegate: entry.delegate }];
  }
}

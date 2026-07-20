import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import {
  InsufficientBalance,
  LateDaysExceedMax,
  LateDaysMustBePositive,
  LateDaysNegative,
  LateUseAlreadyExists,
  LateUseNotFound,
} from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface GrantDoc {
  learner: string;
  days: number;
  reason: string;
  grantedAt: Date;
}

interface UseDoc {
  learner: string;
  item: string;
  days: number;
  status: "APPLIED" | "CANCELED";
  appliedAt: Date;
}

interface Terms {
  allowance: number;
  perItemLimit: number;
  unitHours: number;
}

const DEFAULT_TERMS: Terms = { allowance: 0, perItemLimit: 5, unitHours: 24 };

export class BankingConcept {
  static readonly queries = {
    _getTerms: "one",
    _getBalance: "one",
    _getApplied: "optional",
    _getUses: "many",
    _getUsesForItem: "many",
    _getGrants: "many",
  } as const satisfies Record<string, QueryPromise>;

  private terms: Terms | null = null;
  private readonly grants = new Map<string, GrantDoc>();
  private readonly uses = new Map<string, UseDoc>();

  #terms(): Terms {
    return this.terms ?? DEFAULT_TERMS;
  }

  #appliedUse(learner: string, item: string) {
    for (const [use, doc] of this.uses) {
      if (doc.learner === learner && doc.item === item && doc.status === "APPLIED") {
        return [use, doc] as const;
      }
    }
    return null;
  }

  #balance(learner: string): number {
    let granted = this.#terms().allowance;
    for (const doc of this.grants.values()) {
      if (doc.learner === learner) granted += doc.days;
    }
    let used = 0;
    for (const doc of this.uses.values()) {
      if (doc.learner === learner && doc.status === "APPLIED") used += doc.days;
    }
    return granted - used;
  }

  setTerms({
    allowance,
    perItemLimit,
    unitHours,
  }: {
    allowance: number;
    perItemLimit: number;
    unitHours: number;
  }) {
    this.terms = { allowance, perItemLimit, unitHours };
    return { allowance, perItemLimit, unitHours };
  }

  grant({
    learner,
    days,
    reason,
    at,
  }: {
    learner: string;
    days: number;
    reason: string;
    at: Date;
  }) {
    if (!(days > 0)) {
      throw new LateDaysMustBePositive("A grant must be for a positive number of days.");
    }
    const grant = freshID();
    this.grants.set(grant, { learner, days, reason, grantedAt: at });
    return { grant };
  }

  apply({ learner, item, days, at }: { learner: string; item: string; days: number; at: Date }) {
    if (!(days > 0)) {
      throw new LateDaysMustBePositive("Late days must be a positive number.");
    }
    if (days > this.#terms().perItemLimit) {
      throw new LateDaysExceedMax("That is more late days than any one item may absorb.");
    }
    if (this.#appliedUse(learner, item) !== null) {
      throw new LateUseAlreadyExists("Late days already stand applied to this item.");
    }
    if (days > this.#balance(learner)) {
      throw new InsufficientBalance("The learner's balance is short of the days requested.");
    }
    const use = freshID();
    this.uses.set(use, { learner, item, days, status: "APPLIED", appliedAt: at });
    return { use };
  }

  change({ learner, item, days }: { learner: string; item: string; days: number }) {
    const applied = this.#appliedUse(learner, item);
    if (applied === null) {
      throw new LateUseNotFound("No late days stand applied to this item.");
    }
    if (days < 0) {
      throw new LateDaysNegative("Late days cannot be negative.");
    }
    if (days > this.#terms().perItemLimit) {
      throw new LateDaysExceedMax("That is more late days than any one item may absorb.");
    }
    const [use, doc] = applied;
    const increase = days - doc.days;
    if (increase > this.#balance(learner)) {
      throw new InsufficientBalance("The learner's balance is short of the increase requested.");
    }
    doc.days = days;
    return { use };
  }

  cancel({ learner, item }: { learner: string; item: string }) {
    const applied = this.#appliedUse(learner, item);
    if (applied === null) {
      throw new LateUseNotFound("No late days stand applied to this item.");
    }
    const [use, doc] = applied;
    doc.status = "CANCELED";
    return { use };
  }

  _getTerms(): { allowance: number; perItemLimit: number; unitHours: number } {
    const t = this.#terms();
    return { allowance: t.allowance, perItemLimit: t.perItemLimit, unitHours: t.unitHours };
  }

  _getBalance({ learner }: { learner: string }): {
    granted: number;
    used: number;
    remaining: number;
  } {
    let granted = this.#terms().allowance;
    for (const doc of this.grants.values()) {
      if (doc.learner === learner) granted += doc.days;
    }
    let used = 0;
    for (const doc of this.uses.values()) {
      if (doc.learner === learner && doc.status === "APPLIED") used += doc.days;
    }
    return { granted, used, remaining: granted - used };
  }

  _getApplied({ learner, item }: { learner: string; item: string }): {
    use: string;
    days: number;
    appliedAt: Date;
  }[] {
    const applied = this.#appliedUse(learner, item);
    if (applied === null) return [];
    const [use, doc] = applied;
    return [{ use, days: doc.days, appliedAt: doc.appliedAt }];
  }

  _getUses({ learner }: { learner: string }): {
    use: string;
    item: string;
    days: number;
    status: string;
    appliedAt: Date;
  }[] {
    const rows: {
      use: string;
      item: string;
      days: number;
      status: string;
      appliedAt: Date;
    }[] = [];
    for (const [use, doc] of this.uses) {
      if (doc.learner === learner) {
        rows.push({
          use,
          item: doc.item,
          days: doc.days,
          status: doc.status,
          appliedAt: doc.appliedAt,
        });
      }
    }
    return rows;
  }

  _getUsesForItem({ item }: { item: string }): { learner: string; days: number }[] {
    const rows: { learner: string; days: number }[] = [];
    for (const doc of this.uses.values()) {
      if (doc.item === item && doc.status === "APPLIED") {
        rows.push({ learner: doc.learner, days: doc.days });
      }
    }
    return rows;
  }

  _getGrants({ learner }: { learner: string }): {
    grant: string;
    days: number;
    reason: string;
    grantedAt: Date;
  }[] {
    const rows: { grant: string; days: number; reason: string; grantedAt: Date }[] = [];
    for (const [grant, doc] of this.grants) {
      if (doc.learner === learner) {
        rows.push({ grant, days: doc.days, reason: doc.reason, grantedAt: doc.grantedAt });
      }
    }
    return rows;
  }
}

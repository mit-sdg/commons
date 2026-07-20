import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { TargetAlreadyLocked, TargetNotLocked } from "./errors.ts";

export class LockingConcept {
  static readonly queries = {
    _isLocked: "one",
    _getLocked: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly locked = new Map<string, { lockedAt: Date }>();

  lock({ target, at }: { target: string; at: Date }) {
    if (this.locked.has(target)) {
      throw new TargetAlreadyLocked(`${target} is already locked`);
    }
    this.locked.set(target, { lockedAt: at });
    return { target };
  }

  unlock({ target }: { target: string }) {
    if (!this.locked.has(target)) {
      throw new TargetNotLocked(`${target} is not locked`);
    }
    this.locked.delete(target);
    return { target };
  }

  _isLocked({ target }: { target: string }): { locked: boolean } {
    return { locked: this.locked.has(target) };
  }

  _getLocked(_: Record<string, never>): { target: string; lockedAt: Date }[] {
    return [...this.locked.entries()].map(([target, doc]) => ({
      target,
      lockedAt: doc.lockedAt,
    }));
  }
}

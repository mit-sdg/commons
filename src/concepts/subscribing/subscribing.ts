import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { AlreadySubscribed, NotSubscribed } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface SubscriptionDoc {
  user: string;
  target: string;
  subscribedAt: Date;
}

export class SubscribingConcept {
  static readonly queries = {
    _getSubscribers: "many",
    _getSubscriptions: "many",
    _isSubscribed: "one",
  } as const satisfies Record<string, QueryPromise>;

  private readonly subscriptions = new Map<string, SubscriptionDoc>();

  #findKey(user: string, target: string): string | undefined {
    for (const [subscription, doc] of this.subscriptions) {
      if (doc.user === user && doc.target === target) return subscription;
    }
    return undefined;
  }

  subscribe({ user, target, at }: { user: string; target: string; at: Date }) {
    if (this.#findKey(user, target) !== undefined) {
      throw new AlreadySubscribed(`${user} ${target}`);
    }
    const subscription = freshID();
    this.subscriptions.set(subscription, { user, target, subscribedAt: at });
    return { subscription };
  }

  unsubscribe({ user, target }: { user: string; target: string }) {
    const subscription = this.#findKey(user, target);
    if (subscription === undefined) {
      throw new NotSubscribed(`${user} ${target}`);
    }
    this.subscriptions.delete(subscription);
    return { subscription };
  }

  clearTarget({ target }: { target: string }) {
    for (const [subscription, doc] of this.subscriptions)
      if (doc.target === target) this.subscriptions.delete(subscription);
    return { target };
  }

  _getSubscribers({ target }: { target: string }): { user: string }[] {
    const rows: { user: string }[] = [];
    for (const doc of this.subscriptions.values()) {
      if (doc.target === target) rows.push({ user: doc.user });
    }
    return rows;
  }

  _getSubscriptions({ user }: { user: string }): { target: string; subscribedAt: Date }[] {
    const rows: { target: string; subscribedAt: Date }[] = [];
    for (const doc of this.subscriptions.values()) {
      if (doc.user === user) rows.push({ target: doc.target, subscribedAt: doc.subscribedAt });
    }
    rows.reverse();
    rows.sort((a, b) => b.subscribedAt.getTime() - a.subscribedAt.getTime());
    return rows;
  }

  _isSubscribed({ user, target }: { user: string; target: string }): { subscribed: boolean } {
    return { subscribed: this.#findKey(user, target) !== undefined };
  }
}

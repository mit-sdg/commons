import { ItemAlreadyRegistered, ItemAlreadySeen, ItemNotRegistered } from "./errors.ts";

interface SeenMark {
  user: string;
  item: string;
}

export class TrackingConcept {
  private readonly registered = new Map<string, { scope: string }>();
  private readonly seen: SeenMark[] = [];

  register({ item, scope }: { item: string; scope: string }) {
    if (this.registered.has(item)) {
      throw new ItemAlreadyRegistered(`${item} is already tracked`);
    }
    this.registered.set(item, { scope });
    return { item };
  }

  unregister({ item }: { item: string }) {
    this.registered.delete(item);
    for (let i = this.seen.length - 1; i >= 0; i--) {
      if (this.seen[i].item === item) this.seen.splice(i, 1);
    }
    return { item };
  }

  markSeen({ user, item }: { user: string; item: string }) {
    if (!this.registered.has(item)) {
      throw new ItemNotRegistered(`${item} is not tracked`);
    }
    if (this.seen.some((m) => m.user === user && m.item === item)) {
      throw new ItemAlreadySeen(`${user} ${item}`);
    }
    this.seen.push({ user, item });
    return { item };
  }

  markAllSeen({ user, scope }: { user: string; scope: string }) {
    for (const [item, doc] of this.registered) {
      if (doc.scope !== scope) continue;
      if (!this.seen.some((m) => m.user === user && m.item === item)) {
        this.seen.push({ user, item });
      }
    }
    return { user };
  }

  _inScope({ scope }: { scope: string }): { item: string }[] {
    return [...this.registered.entries()]
      .filter(([, doc]) => doc.scope === scope)
      .map(([item]) => ({ item }));
  }

  _getUnread({ user, scope }: { user: string; scope: string }): { item: string }[] {
    return [...this.registered.entries()]
      .filter(
        ([item, doc]) =>
          doc.scope === scope && !this.seen.some((m) => m.user === user && m.item === item),
      )
      .map(([item]) => ({ item }));
  }

  _getUnreadCount({ user, scope }: { user: string; scope: string }): { count: number } {
    return { count: this._getUnread({ user, scope }).length };
  }
}

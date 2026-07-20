import { ItemAlreadyPinned, ItemNotPinned } from "./errors.ts";

const freshID = () => crypto.randomUUID();

interface PinDoc {
  item: string;
  scope: string;
  priority: number;
  pinnedAt: Date;
  seq: number;
}

export class PinningConcept {
  private readonly pins = new Map<string, PinDoc>();
  private seq = 0;

  #findKey(item: string, scope: string): string | undefined {
    for (const [pin, doc] of this.pins) {
      if (doc.item === item && doc.scope === scope) return pin;
    }
    return undefined;
  }

  pin({ item, scope, priority, at }: { item: string; scope: string; priority: number; at: Date }) {
    if (this.#findKey(item, scope) !== undefined) {
      throw new ItemAlreadyPinned(`${item} ${scope}`);
    }
    const pin = freshID();
    this.pins.set(pin, { item, scope, priority, pinnedAt: at, seq: (this.seq += 1) });
    return { pin };
  }

  unpin({ item, scope }: { item: string; scope: string }) {
    const pin = this.#findKey(item, scope);
    if (pin === undefined) {
      throw new ItemNotPinned(`${item} ${scope}`);
    }
    this.pins.delete(pin);
    return { pin };
  }

  setPriority({ item, scope, priority }: { item: string; scope: string; priority: number }) {
    const pin = this.#findKey(item, scope);
    if (pin === undefined) {
      throw new ItemNotPinned(`${item} ${scope}`);
    }
    const doc = this.pins.get(pin);
    if (doc !== undefined) doc.priority = priority;
    return { pin };
  }

  clearItem({ item }: { item: string }) {
    for (const [pin, doc] of this.pins) {
      if (doc.item === item) this.pins.delete(pin);
    }
    return { item };
  }

  _getPinned({ scope }: { scope: string }): { item: string; priority: number }[] {
    return [...this.pins.values()]
      .filter((doc) => doc.scope === scope)
      .sort((a, b) => b.priority - a.priority || b.seq - a.seq)
      .map((doc) => ({ item: doc.item, priority: doc.priority }));
  }

  _isPinned({ item, scope }: { item: string; scope: string }): { pinned: boolean } {
    return { pinned: this.#findKey(item, scope) !== undefined };
  }
}

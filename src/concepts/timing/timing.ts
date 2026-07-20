import type { QueryPromise } from "@mit-sdg/sync-engine/language";
export class TimingConcept {
  static readonly queries = {
    _now: "one",
  } as const satisfies Record<string, QueryPromise>;

  constructor(private readonly read: () => Date = () => new Date()) {}

  capture(_: Record<string, never>): { at: Date } {
    return { at: this.read() };
  }

  _now(): { at: Date } {
    return { at: this.read() };
  }
}

export class TimingConcept {
  constructor(private readonly read: () => Date = () => new Date()) {}

  capture(_: Record<string, never>): { at: Date } {
    return { at: this.read() };
  }

  _now(): { at: Date } {
    return { at: this.read() };
  }
}

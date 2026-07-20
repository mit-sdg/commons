import type { QueryPromise } from "@mit-sdg/sync-engine/language";
import { CriterionNotFound, GradeItemNotFound, ScoreOutOfRange } from "./errors.ts";

const freshID = () => crypto.randomUUID();

export class ItemizingConcept {
  static readonly queries = {
    _getItem: "optional",
    _getItems: "many",
    _getCriteria: "many",
    _getCriterion: "optional",
  } as const satisfies Record<string, QueryPromise>;

  private readonly items = new Map<
    string,
    { item: string; label: string; maxPoints: number; status: "ACTIVE" | "ARCHIVED" }
  >();
  private readonly criteria = new Map<
    string,
    { item: string; name: string; maxPoints: number; position: number }
  >();

  #activeItem(item: string): [string, { label: string; maxPoints: number }] | null {
    for (const [gradeItem, doc] of this.items) {
      if (doc.item === item && doc.status === "ACTIVE") return [gradeItem, doc];
    }
    return null;
  }

  configureItem({ item, label, maxPoints }: { item: string; label: string; maxPoints: number }) {
    if (maxPoints < 0) {
      throw new ScoreOutOfRange(`maxPoints ${maxPoints}`);
    }
    const active = this.#activeItem(item);
    if (active !== null) {
      const [gradeItem, doc] = active;
      doc.label = label;
      doc.maxPoints = maxPoints;
      return { gradeItem };
    }
    const gradeItem = freshID();
    this.items.set(gradeItem, { item, label, maxPoints, status: "ACTIVE" });
    return { gradeItem };
  }

  ensureItem({ item, label, maxPoints }: { item: string; label: string; maxPoints: number }) {
    const active = this.#activeItem(item);
    if (active !== null) return { gradeItem: active[0] };
    const gradeItem = freshID();
    this.items.set(gradeItem, { item, label, maxPoints, status: "ACTIVE" });
    return { gradeItem };
  }

  archiveItem({ item }: { item: string }) {
    const active = this.#activeItem(item);
    if (active === null) {
      throw new GradeItemNotFound(item);
    }
    const doc = this.items.get(active[0]);
    if (doc !== undefined) doc.status = "ARCHIVED";
    return { gradeItem: active[0] };
  }

  addCriterion({
    item,
    name,
    maxPoints,
    position,
  }: {
    item: string;
    name: string;
    maxPoints: number;
    position: number;
  }) {
    if (this.#activeItem(item) === null) {
      throw new GradeItemNotFound(item);
    }
    const criterion = freshID();
    this.criteria.set(criterion, { item, name, maxPoints, position });
    return { criterion };
  }

  reviseCriterion({
    criterion,
    name,
    maxPoints,
    position,
  }: {
    criterion: string;
    name: string;
    maxPoints: number;
    position: number;
  }) {
    const doc = this.criteria.get(criterion);
    if (doc === undefined) {
      throw new CriterionNotFound(criterion);
    }
    doc.name = name;
    doc.maxPoints = maxPoints;
    doc.position = position;
    return { criterion };
  }

  removeCriterion({ criterion }: { criterion: string }) {
    if (!this.criteria.has(criterion)) {
      throw new CriterionNotFound(criterion);
    }
    this.criteria.delete(criterion);
    return { criterion };
  }

  _getItem({ item }: { item: string }): {
    item: string;
    label: string;
    maxPoints: number;
    status: string;
  }[] {
    const active = this.#activeItem(item);
    if (active === null) return [];
    const doc = active[1];
    return [{ item, label: doc.label, maxPoints: doc.maxPoints, status: "ACTIVE" }];
  }

  _getItems(_: Record<string, never>): { item: string; label: string; maxPoints: number }[] {
    return [...this.items.values()]
      .filter((doc) => doc.status === "ACTIVE")
      .map((doc) => ({ item: doc.item, label: doc.label, maxPoints: doc.maxPoints }));
  }

  _getCriteria({ item }: { item: string }): {
    criterion: string;
    name: string;
    maxPoints: number;
    position: number;
  }[] {
    return [...this.criteria.entries()]
      .filter(([, doc]) => doc.item === item)
      .sort(([, a], [, b]) => a.position - b.position)
      .map(([criterion, doc]) => ({
        criterion,
        name: doc.name,
        maxPoints: doc.maxPoints,
        position: doc.position,
      }));
  }

  _getCriterion({ criterion }: { criterion: string }): {
    item: string;
    name: string;
    maxPoints: number;
  }[] {
    const doc = this.criteria.get(criterion);
    if (doc === undefined) return [];
    return [{ item: doc.item, name: doc.name, maxPoints: doc.maxPoints }];
  }
}

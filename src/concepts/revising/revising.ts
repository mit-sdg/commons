const freshID = () => crypto.randomUUID();

interface RevisionDoc {
  item: string;
  number: number;
  content: string;
  savedAt: Date;
}

type Row = { revision: string; number: number; content: string; savedAt: Date };

export class RevisingConcept {
  private readonly revisions = new Map<string, RevisionDoc>();

  #highestNumber(item: string): number {
    let highest = 0;
    for (const doc of this.revisions.values()) {
      if (doc.item === item && doc.number > highest) highest = doc.number;
    }
    return highest;
  }

  record({ item, content, at }: { item: string; content: string; at: Date }) {
    const number = this.#highestNumber(item) + 1;
    const revision = freshID();
    this.revisions.set(revision, { item, number, content, savedAt: at });
    return { revision, number };
  }

  clearItem({ item }: { item: string }) {
    for (const [revision, doc] of this.revisions) {
      if (doc.item === item) this.revisions.delete(revision);
    }
    return { item };
  }

  #rowsFor(item: string): Row[] {
    const rows: Row[] = [];
    for (const [revision, doc] of this.revisions) {
      if (doc.item === item) {
        rows.push({ revision, number: doc.number, content: doc.content, savedAt: doc.savedAt });
      }
    }
    return rows.sort((a, b) => a.number - b.number);
  }

  _getRevisions({ item }: { item: string }): Row[] {
    return this.#rowsFor(item);
  }

  _getRevision({ item, number }: { item: string; number: number }): Row[] {
    for (const [revision, doc] of this.revisions) {
      if (doc.item === item && doc.number === number) {
        return [{ revision, number: doc.number, content: doc.content, savedAt: doc.savedAt }];
      }
    }
    return [];
  }

  _getLatest({ item }: { item: string }): Row[] {
    const rows = this.#rowsFor(item);
    return rows.length === 0 ? [] : [rows[rows.length - 1]];
  }
}

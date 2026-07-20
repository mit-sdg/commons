import type { QueryPromise } from "@mit-sdg/sync-engine/language";
export class LinkingConcept {
  static readonly queries = {
    _getLinks: "many",
    _getBacklinks: "many",
  } as const satisfies Record<string, QueryPromise>;

  private readonly links = new Map<string, string[]>();

  setLinks({ source, targets }: { source: string; targets: string[] }) {
    this.links.set(source, [...targets]);
    return { source };
  }

  setLinksFrom({ source, content }: { source: string; content: string }) {
    const targets = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]);
    this.links.set(source, targets);
    return { source };
  }

  clearLinks({ source }: { source: string }) {
    this.links.delete(source);
    return { source };
  }

  clearBacklinks({ target }: { target: string }) {
    for (const [source, targets] of this.links) {
      if (targets.includes(target)) {
        this.links.set(
          source,
          targets.filter((t) => t !== target),
        );
      }
    }
    return { target };
  }

  _getLinks({ source }: { source: string }): { target: string }[] {
    return (this.links.get(source) ?? []).map((target) => ({ target }));
  }

  _getBacklinks({ target }: { target: string }): { source: string }[] {
    const rows: { source: string }[] = [];
    for (const [source, targets] of this.links) {
      if (targets.includes(target)) rows.push({ source });
    }
    return rows;
  }
}

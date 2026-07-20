import { TagAlreadyApplied, TagAlreadyExists, TagNotApplied, TagNotFound } from "./errors.ts";

const freshID = () => crypto.randomUUID();

export class TaggingConcept {
  private readonly tags = new Map<string, string>();
  private readonly targets = new Map<string, string[]>();

  createTag({ name }: { name: string }) {
    for (const existing of this.tags.values()) {
      if (existing === name) throw new TagAlreadyExists(name);
    }
    const tag = freshID();
    this.tags.set(tag, name);
    return { tag };
  }

  addTag({ target, tag }: { target: string; tag: string }) {
    if (!this.tags.has(tag)) {
      throw new TagNotFound(tag);
    }
    const applied = this.targets.get(target) ?? [];
    if (applied.includes(tag)) {
      throw new TagAlreadyApplied(tag);
    }
    this.targets.set(target, [...applied, tag]);
    return { target };
  }

  removeTag({ target, tag }: { target: string; tag: string }) {
    const applied = this.targets.get(target);
    if (applied === undefined || !applied.includes(tag)) {
      throw new TagNotApplied(tag);
    }
    const remaining = applied.filter((t) => t !== tag);
    if (remaining.length === 0) this.targets.delete(target);
    else this.targets.set(target, remaining);
    return { target };
  }

  deleteTag({ tag }: { tag: string }) {
    if (!this.tags.has(tag)) {
      throw new TagNotFound(tag);
    }
    for (const [target, applied] of this.targets) {
      const remaining = applied.filter((t) => t !== tag);
      if (remaining.length === 0) this.targets.delete(target);
      else this.targets.set(target, remaining);
    }
    this.tags.delete(tag);
    return { tag };
  }

  clearTarget({ target }: { target: string }) {
    this.targets.delete(target);
    return { target };
  }

  _getTags({ target }: { target: string }): { tag: string; name: string }[] {
    return (this.targets.get(target) ?? []).flatMap((tag) => {
      const name = this.tags.get(tag);
      return name === undefined ? [] : [{ tag, name }];
    });
  }

  _getTargets({ tag }: { tag: string }): { target: string }[] {
    return [...this.targets.entries()]
      .filter(([, applied]) => applied.includes(tag))
      .map(([target]) => ({ target }));
  }

  _getByName({ name }: { name: string }): { tag: string }[] {
    for (const [tag, existing] of this.tags) {
      if (existing === name) return [{ tag }];
    }
    return [];
  }

  _getAllTags(_: Record<string, never>): { tag: string; name: string }[] {
    return [...this.tags.entries()].map(([tag, name]) => ({ tag, name }));
  }
}

import { kindChoices, kindParts, kindCap } from "./live-rounds.ts";
import { pileCards } from "./live-carries.ts";
import type { ContextGroup, RunSnapshot } from "./live-snapshots.ts";

interface Pile {
  category: string;
}

/**
 * How the piles a request picks stand on the wall they are picked from: `none`
 * when it picks nothing, `gone` when a picked pile is no longer there, and
 * `ready` otherwise.
 */
export function pickStanding({
  picked,
  categories,
}: {
  picked: string[];
  categories: Pile[];
}): string {
  if (picked.length === 0) return "none";
  const standing = new Set(categories.map(({ category }) => category));
  return picked.every((pile) => standing.has(pile)) ? "ready" : "gone";
}

/** Resolve names and examples once, in the order the request names them. */
export function openingGroups({
  picked,
  categories,
  values,
  value,
}: Omit<Parameters<typeof pileCards>[0], "pile"> & { picked: string[] }): ContextGroup[] {
  return picked.flatMap((pile) => {
    const category = categories.find((entry) => entry.category === pile);
    return category === undefined
      ? []
      : [{ name: category.name, cards: pileCards({ pile, categories, values, value }) }];
  });
}

/**
 * The round as the room meets it: the leg's question as it stands, under its
 * kind, with what it takes from its source filled in from the picked groups.
 */
export function roundPresentation({
  content,
  kind,
  use,
  groups,
  sourceValue,
  sourceNumber,
}: {
  content: unknown;
  kind: string;
  use: unknown;
  groups: unknown;
  sourceValue: unknown;
  sourceNumber: unknown;
}): RunSnapshot {
  const source = content as RunSnapshot;
  const carried = (groups ?? []) as ContextGroup[];
  const names = [...new Set(carried.map(({ name }) => name))];
  const from =
    typeof sourceNumber === "number" && sourceValue != null
      ? { contextSource: { number: sourceNumber, title: (sourceValue as RunSnapshot).title } }
      : {};
  return {
    ...source,
    questions: source.questions.map((question) => {
      if (use === "choices")
        return {
          ...question,
          ...from,
          choices: names,
          parts: [],
          cap: 0,
          context: carried,
          contextUse: "choices",
          choiceSources: carried,
        };
      if (use === "parts")
        return {
          ...question,
          ...from,
          choices: [],
          parts: names,
          cap: 0,
          context: carried,
          contextUse: "parts",
        };
      return {
        ...question,
        ...from,
        choices: kindChoices({ kind, choices: question.choices }),
        parts: kindParts({ kind, parts: question.parts ?? [] }),
        cap: kindCap({ kind, cap: question.cap ?? 0 }),
        ...(use === "context" ? { context: carried, contextUse: "context" } : {}),
      };
    }),
  };
}

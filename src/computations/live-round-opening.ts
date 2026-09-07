import { kindChoices, kindParts, kindCap } from "./live-rounds.ts";
import { pileCards } from "./live-carries.ts";
import type { ContextGroup, RunSnapshot } from "./live-snapshots.ts";

/** An observed admission is used once to prepare this round-opening proposal. */
export function openingAuthorized(_input: Record<string, never>): boolean {
  return true;
}

export function openingAdmission({
  authorized,
  relay,
  legRelay,
  open,
  openRound,
  ran,
  source,
  sourceRound,
  sourceOpen,
  groups,
  content,
}: {
  authorized: unknown;
  relay: unknown;
  legRelay: unknown;
  open: unknown;
  openRound: unknown;
  ran: unknown;
  source: unknown;
  sourceRound: unknown;
  sourceOpen: unknown;
  groups: unknown;
  content: unknown;
}): string {
  if (authorized !== true) return "FORBIDDEN";
  if (typeof relay !== "string" || relay !== legRelay) return "LEG_NOT_FOUND";
  if (content == null) return "LEG_NOT_FOUND";
  if (open !== true) return "CLOSED";
  if (typeof openRound === "string") return "ROUND_OPEN";
  if (typeof ran === "string") return "ROUND_DONE";
  if (typeof source === "string") {
    if (typeof sourceRound !== "string" || sourceOpen !== false) return "SOURCE_OPEN";
    if (!Array.isArray(groups) || groups.length === 0) return "NOTHING_PICKED";
  }
  return "";
}

/** Resolve names and examples once, in the observed pick order. */
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

interface OpeningBrief {
  author: string;
  material: string;
  presentation: RunSnapshot;
}

/** The publication instruction carries the whole presentation, not a later reread. */
export function openingBrief({
  account,
  author,
  questionnaire,
  kind,
  use,
  content,
  groups,
}: {
  account: string;
  author: string;
  questionnaire: string;
  kind: string;
  use: unknown;
  content: unknown;
  groups: unknown;
}): string {
  if (account !== "") return "";
  const source = content as RunSnapshot;
  const carried = (groups ?? []) as ContextGroup[];
  const names = [...new Set(carried.map(({ name }) => name))];
  const presentation: RunSnapshot = {
    ...source,
    questions: source.questions.map((question) => {
      if (use === "choices")
        return {
          ...question,
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
          choices: [],
          parts: names,
          cap: 0,
          context: carried,
          contextUse: "parts",
        };
      return {
        ...question,
        choices: kindChoices({ kind, choices: question.choices }),
        parts: kindParts({ kind, parts: question.parts ?? [] }),
        cap: kindCap({ kind, cap: question.cap ?? 0 }),
        ...(use === "context" ? { context: carried, contextUse: "context" } : {}),
      };
    }),
  };
  return JSON.stringify({ author, material: questionnaire, presentation } satisfies OpeningBrief);
}

export function openingAuthor({ brief }: { brief: string }): string {
  return (JSON.parse(brief) as OpeningBrief).author;
}

export function openingMaterial({ brief }: { brief: string }): string {
  return (JSON.parse(brief) as OpeningBrief).material;
}

export function openingPresentation({ brief }: { brief: string }): RunSnapshot {
  return (JSON.parse(brief) as OpeningBrief).presentation;
}

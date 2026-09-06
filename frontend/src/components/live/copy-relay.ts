import { api, isApiError, type Output } from "@/lib/api";
import { mintedRelayTitle } from "../../../../src/computations/live-edits.ts";

type FetchedRelay = NonNullable<Output<"/live/relays/get">["relay"]>;

/** One round as copying replays it; a take names its source by number. */
export interface CopyableRound {
  title: string;
  kind: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  piles: { name: string; description: string }[];
  notes: string;
  takes?: { from: number; use: string };
}

/** A standing relay, read into the shape copying replays. */
export function roundsToCopy(relay: FetchedRelay): CopyableRound[] {
  return relay.rounds.map((round) => {
    const takes = round.takes[0];
    return {
      title: round.title,
      kind: round.kind,
      prompt: round.prompt,
      parts: round.parts,
      cap: round.cap,
      choices: round.choices,
      piles: round.piles.map((pile) => ({
        name: pile.name,
        description: pile.description,
      })),
      notes: round.notes,
      takes:
        takes === undefined
          ? undefined
          : { from: takes.sourceNumber, use: takes.use },
    };
  });
}

/**
 * Copying plays the same requests a staff member would send by hand, in order:
 * each round with the kind that was pressed for it, its standing piles, and
 * its note, then what each round takes. The relay is planned first, so its
 * title is the one the author typed rather than the source's.
 */
export async function copyRounds(
  relay: string,
  source: CopyableRound[],
): Promise<{ relay: string } | { error: string }> {
  const legs: string[] = [];
  for (const round of source) {
    const added = await api["/live/relays/add-round"]({
      relay,
      title: round.title,
      prompt: round.prompt,
      parts: round.parts,
      cap: round.cap,
      choices: round.choices,
    });
    if (isApiError(added)) return added;
    legs.push(added.leg);
    if (round.kind !== "") {
      const named = await api["/live/relays/set-kind"]({
        leg: added.leg,
        kind: round.kind,
      });
      if (isApiError(named)) return named;
    }
    for (const pile of round.piles) {
      const stood = await api["/live/rounds/add-pile"]({
        leg: added.leg,
        name: pile.name,
        description: pile.description,
      });
      if (isApiError(stood)) return stood;
    }
    if (round.notes !== "") {
      const noted = await api["/live/rounds/set-notes"]({
        leg: added.leg,
        body: round.notes,
      });
      if (isApiError(noted)) return noted;
    }
  }

  for (const [index, round] of source.entries()) {
    const takes = round.takes;
    if (takes === undefined || takes.use === "") continue;
    const from = legs[takes.from - 1];
    const leg = legs[index];
    if (from === undefined || leg === undefined) continue;
    const drawn = await api["/live/relays/set-takes"]({
      leg,
      source: from,
      use: takes.use,
    });
    if (isApiError(drawn)) return drawn;
  }

  return { relay };
}

/**
 * The background the copy carries: the source's documents, in the order they
 * stand there, given on the relay the plan has already made.
 */
export async function copyDocuments(
  relay: string,
  source: string,
): Promise<{ relay: string } | { error: string }> {
  const read = await api["/live/references/get"]({ subject: source });
  if (isApiError(read)) return read;
  const selected = await api["/live/references/select"]({
    subject: relay,
    references: read.references,
  });
  if (isApiError(selected)) return selected;

  return { relay };
}

/**
 * The same move for a questionnaire: the source's questions, in order, added
 * to a questionnaire the create endpoint has already made.
 */
export async function copyQuestionnaire(
  questionnaire: string,
  source: string,
): Promise<{ questionnaire: string } | { error: string }> {
  const read = await api["/live/quizzes/get"]({ questionnaire: source });
  if (isApiError(read)) return read;
  const sheet = read.questionnaire;
  if (sheet === null) return { error: "NOT_FOUND" };

  for (const question of sheet.questions) {
    const added = await api["/live/quizzes/add-question"]({
      questionnaire,
      prompt: question.prompt,
      choices: question.choices,
      expected: question.expected,
      explanation: question.explanation,
    });
    if (isApiError(added)) return added;
  }

  const selected = await copyDocuments(questionnaire, source);
  if (isApiError(selected)) return selected;
  return { questionnaire };
}

/** The relay a brief names, before the model has drafted anything into it: the same string the edits page mints, so the reasoner's title is taken without confirmation. */
export function titleFromBrief(brief: string): string {
  return mintedRelayTitle({ request: brief });
}

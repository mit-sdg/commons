/**
 * The passages the wall puts before the reasoner, and the readings of what it
 * replies. The contract is the same shape the drafting loop uses: the reasoner
 * answers in JSON mode, one object per reply, and every reply reads as exactly
 * one of three kinds — cards placed, a pile's lid, or neither. Cards are named
 * by short labels in the order the room handed them in, and read back by the
 * same order.
 */

import { cardId } from "./live-rounds.ts";
import {
  participantQuestions,
  partLabel,
  questionItems,
  type RunSnapshotQuestion,
} from "./live-snapshots.ts";

interface PileWithItems {
  category: string;
  name: string;
  description: string;
  items: string[];
}

interface RunValue {
  response: string;
  participant: string;
  item: string;
  value: string;
}

interface SuggestionLine {
  kind: string;
  target: string;
  value: string;
}

interface Answer {
  item: string;
  value: string;
}

type Reading =
  | { kind: "placed"; lines: SuggestionLine[] }
  | { kind: "lid"; lines: SuggestionLine[] }
  | { kind: "neither"; reason: string };

/** The first line of each passage, which is also how the scripted mind knows it. */
export const PLACING_OPENING = "You sort a classroom's answers into piles.";
export const LID_OPENING = "You write the lid on one pile of a classroom's answers.";
export const PARTICIPANT_OPENING = "You answer a classroom question as one participant.";

const PLACING_CONTRACT = `${PLACING_OPENING}
Reply with exactly one JSON object and nothing else.

{"kind":"placed","placements":[{"card":"c1","pile":"Worked examples"}]}
- Place every card listed below, once each, naming it by its label.
- "pile" is the name of a pile on the list, or a short new pile name of your own.
- Keep a new pile's name to three words at most, and open as few as the answers allow.`;

const LID_CONTRACT = `${LID_OPENING}
Reply with exactly one JSON object and nothing else.

{"kind":"lid","pile":"<the pile id below>","sentence":"..."}
- "pile" is exactly the pile id given below.
- "sentence" is one sentence of at most twenty words saying what these answers share.`;

const PARTICIPANT_CONTRACT = `${PARTICIPANT_OPENING}
Reply with exactly one JSON object and nothing else.

{"kind":"answers","answers":[{"item":"<box>","value":"..."}]}
- One answer per box listed below; "item" is the box's name copied exactly, with nothing added.
- When choices are offered, answer with one of them, word for word.
- Otherwise answer in a few words, the way one student typing on a phone would.
- Answer the question; never repeat or restate its words back.
- Answer as this participant, not as the room's average: take the stance given below and let it show.`;

/** The stances a room of participants is dealt, one per participant, by its identity. */
const STANCES = [
  "the student who answers from a concrete example they saw this week",
  "the student who answers with the plainest everyday word",
  "the student who reaches for the odd case nobody else thinks of",
  "the student who answers from the user's frustration",
  "the student who answers from what the software must remember",
  "the student who answers in the words of a shop or a bank, not a textbook",
  "the student who disagrees with the obvious answer",
  "the student who answers from a phone app they use daily",
  "the student who thinks about what could go wrong",
  "the student who answers quickly and briefly, first thing that comes",
  "the student who answers from a course or classroom situation",
  "the student who thinks about two people using the same thing",
];

function stanceOf(participant: string): string {
  let hash = 0;
  for (const char of participant) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return STANCES[hash % STANCES.length] as string;
}

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asRows = <Row>(rows: unknown): Row[] => (Array.isArray(rows) ? (rows as Row[]) : []);

/** The captured question in the shape the snapshot calculations read. */
function questionsOf(value: unknown): RunSnapshotQuestion[] {
  return participantQuestions({ value }).map((question) => ({
    item: question.question,
    prompt: question.prompt,
    choices: question.choices,
    expected: "",
    explanation: "",
    parts: question.parts,
    cap: question.cap,
    position: question.position,
  }));
}

function promptOf(value: unknown): string {
  return questionsOf(value)[0]?.prompt ?? "";
}

function cardsOf(values: RunValue[]): { label: string; card: string; value: string }[] {
  return asRows<RunValue>(values).map((entry, index) => ({
    label: `c${index + 1}`,
    card: cardId({ response: entry.response, item: entry.item }),
    value: entry.value,
  }));
}

function trayOf(categories: PileWithItems[], values: RunValue[]) {
  const home = new Set(asRows<PileWithItems>(categories).flatMap((pile) => pile.items));
  return cardsOf(values).filter((card) => !home.has(card.card));
}

function standing(value: unknown, categories: PileWithItems[], values: RunValue[]): string {
  const piles = asRows<PileWithItems>(categories);
  const listed =
    piles.length === 0
      ? "No piles yet."
      : piles
          .map(
            (pile) =>
              `- ${pile.name} (${pile.items.length} cards)${pile.description === "" ? "" : `: ${pile.description}`}`,
          )
          .join("\n");
  const tray = trayOf(categories, values);
  const cards =
    tray.length === 0
      ? "No cards are waiting."
      : tray.map((card) => `${card.label}. ${card.value}`).join("\n");
  return `The question:\n${promptOf(value)}\n\nThe piles as they stand:\n${listed}\n\nThe cards to place:\n${cards}`;
}

export function placingPassage({
  value,
  categories,
  values,
}: {
  value: unknown;
  categories: PileWithItems[];
  values: RunValue[];
}): string {
  return `${PLACING_CONTRACT}\n\n${standing(value, categories, values)}`;
}

export function placingRepairPassage({
  value,
  categories,
  values,
  offering,
  account,
}: {
  value: unknown;
  categories: PileWithItems[];
  values: RunValue[];
  offering: string;
  account: string;
}): string {
  return `${PLACING_CONTRACT}\n\n${standing(value, categories, values)}\n\nYour previous reply came back unusable. The reply was:\n${offering}\n\nThe account of the problem:\n${account}\n\nDeliver a correct reply this time.`;
}

export function lidPassage({
  pile,
  categories,
  values,
}: {
  pile: string;
  categories: PileWithItems[];
  values: RunValue[];
}): string {
  const found = asRows<PileWithItems>(categories).find((entry) => entry.category === pile);
  const written = new Map(cardsOf(values).map((card) => [card.card, card.value]));
  const cards = (found?.items ?? []).map((item) => `- ${written.get(item) ?? ""}`);
  return `${LID_CONTRACT}\n\nThe pile id: ${pile}\nThe pile's name: ${found?.name ?? ""}\n\nIts cards:\n${cards.length === 0 ? "No cards." : cards.join("\n")}`;
}

export function participantPassage({
  value,
  participant,
}: {
  value: unknown;
  participant: string;
}): string {
  const questions = questionsOf(value);
  const question = questions[0];
  const boxes = questions.flatMap((entry) =>
    questionItems(entry).map((item) => {
      const label = partLabel({ value, item });
      return `${item} — ${label === "" ? "your answer" : label}`;
    }),
  );
  const choices =
    question === undefined || question.choices.length === 0
      ? ""
      : `\n\nChoose from: ${question.choices.join(" | ")}`;
  return `${PARTICIPANT_CONTRACT}\n\nYou are participant ${participant}, ${stanceOf(participant)}.\n\nThe question:\n${question?.prompt ?? ""}${choices}\n\nThe boxes to answer, one line each:\n${boxes.join("\n")}`;
}

/**
 * Which box a reply meant. A reply that dresses the name up — a "box " or
 * "item " word in front, another case — still names the box it was given.
 */
function boxNamer(items: string[]): (named: string) => string | undefined {
  const byName = new Map(items.map((item) => [item.toLowerCase(), item]));
  return (named) => {
    const cleaned = named
      .trim()
      .replace(/^(box|item)\s+/i, "")
      .trim()
      .toLowerCase();
    return byName.get(cleaned) ?? items.find((item) => cleaned.endsWith(item.toLowerCase()));
  };
}

function readLid(record: Record<string, unknown>, categories: PileWithItems[]): Reading {
  const pile = asString(record.pile);
  const sentence = asString(record.sentence).trim();
  if (!asRows<PileWithItems>(categories).some((entry) => entry.category === pile)) {
    return { kind: "neither", reason: "The lid named no pile on this wall." };
  }
  if (sentence === "") {
    return { kind: "neither", reason: "The lid carried no sentence." };
  }
  return { kind: "lid", lines: [{ kind: "lid", target: pile, value: sentence }] };
}

function readPlacements(
  record: Record<string, unknown>,
  categories: PileWithItems[],
  values: RunValue[],
): Reading {
  if (!Array.isArray(record.placements) || record.placements.length === 0) {
    return { kind: "neither", reason: "The reply placed no cards." };
  }
  const byLabel = new Map(trayOf(categories, values).map((card) => [card.label, card.card]));
  const byName = new Map(
    asRows<PileWithItems>(categories).map((pile) => [pile.name, pile.category]),
  );
  const lines: SuggestionLine[] = [];
  for (const entry of record.placements) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { kind: "neither", reason: "A placement was not a JSON object." };
    }
    const placement = entry as Record<string, unknown>;
    const label = asString(placement.card);
    const card = byLabel.get(label);
    if (card === undefined) {
      return { kind: "neither", reason: `"${label}" names no card waiting in the tray.` };
    }
    const name = asString(placement.pile).trim();
    if (name === "") {
      return { kind: "neither", reason: "A placement named no pile." };
    }
    const existing = byName.get(name);
    lines.push(
      existing === undefined
        ? { kind: "open", target: card, value: name }
        : { kind: "place", target: card, value: existing },
    );
  }
  return { kind: "placed", lines };
}

function read(reply: string, categories: PileWithItems[], values: RunValue[]): Reading {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return { kind: "neither", reason: "The reply was not readable JSON." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "neither", reason: "The reply was not a JSON object." };
  }
  const record = parsed as Record<string, unknown>;
  if (record.kind === "lid") return readLid(record, categories);
  if (record.kind === "placed") return readPlacements(record, categories, values);
  return { kind: "neither", reason: "The reply named no recognizable kind." };
}

export function placingReading({
  reply,
  categories,
  values,
}: {
  reply: string;
  categories: PileWithItems[];
  values: RunValue[];
}): string {
  return read(reply, categories, values).kind;
}

export function placingLines({
  reply,
  categories,
  values,
}: {
  reply: string;
  categories: PileWithItems[];
  values: RunValue[];
}): SuggestionLine[] {
  const reading = read(reply, categories, values);
  return reading.kind === "placed" ? reading.lines : [];
}

export function placingReason({
  reply,
  categories,
  values,
}: {
  reply: string;
  categories: PileWithItems[];
  values: RunValue[];
}): string {
  const reading = read(reply, categories, values);
  return reading.kind === "neither" ? reading.reason : "";
}

export function lidLines({
  reply,
  categories,
}: {
  reply: string;
  categories: PileWithItems[];
}): SuggestionLine[] {
  const reading = read(reply, categories, []);
  return reading.kind === "lid" ? reading.lines : [];
}

export function participantAnswers({ reply, value }: { reply: string; value: unknown }): Answer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(reply);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
  const record = parsed as Record<string, unknown>;
  if (record.kind !== "answers" || !Array.isArray(record.answers)) return [];
  const named = boxNamer(questionsOf(value).flatMap(questionItems));
  const answered = new Set<string>();
  const answers: Answer[] = [];
  for (const entry of record.answers) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const answer = entry as Record<string, unknown>;
    const item = named(asString(answer.item));
    const said = asString(answer.value).trim();
    if (item === undefined || answered.has(item) || said === "") continue;
    answered.add(item);
    answers.push({ item, value: said });
  }
  return answers;
}

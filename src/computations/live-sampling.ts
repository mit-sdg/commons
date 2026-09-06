/**
 * The passage the editor puts before the reasoner to sample a round, and the
 * readings of what it replies. The contract is a variant of the placing
 * contract: the same rules about piles, but the cards are the reasoner's own —
 * one answer per stance of the participant passage, each placed as it is
 * written — so a staff member sees what a room might say and how it would sort
 * before the round ever runs.
 */

import { roundKind } from "./live-carries.ts";
import { notesOf, PILE_RULES, STANCES } from "./live-walls.ts";

interface StandingPile {
  category: string;
  name: string;
  description: string;
}

interface SampleGroup {
  name: string;
  cards: string[];
}

interface SampledAnswer {
  value: string;
  pile: string;
}

/** The first line of the passage, which is also how the scripted mind knows it. */
export const SAMPLING_OPENING =
  "You write the answers a classroom might give and sort them into piles.";

const SAMPLING_CONTRACT = `${SAMPLING_OPENING}
Reply with exactly one JSON object and nothing else.

{"kind":"sampled","answers":[{"value":"...","pile":"worked examples"}]}
- Write one answer per participant listed below, in their order; "value" is the answer and "pile" is the pile it belongs in.
- Each participant answers the way one participant typing on a phone would, at the length the question asks for: one word when it asks for one, one plain sentence when it asks for a sentence or a rewrite, a few words otherwise.
- Follow the setting and subject of the question and any shown context. Do not assume a software class: a faculty icebreaker, staff onboarding, or another activity calls for answers in that setting. Use each stance only where it fits the question; never let it change the subject. Prefer plausible everyday examples and stakes; an unusual perspective does not require a catastrophe or a contrived crisis unless the question asks for exceptional cases.
- Answer the question; never repeat or restate its words back.
- When asked to refine or build on earlier examples, use the supplied synthetic cards as the source. Preserve their concrete details; do not substitute unrelated situations. Pile names or vote labels alone do not establish an original scenario.
- Each participant answers from the stance given. Vary open answers naturally, but allow repeated words or synonymous concept names when the question calls for them; do not invent unrelated answers merely for variety.
- When choices are offered, every answer is one of them, word for word, and its pile is that choice.
- When the question has several boxes, each answer fills one box, taken in turn.
${PILE_RULES}`;

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

const asRows = <Row>(rows: unknown): Row[] => (Array.isArray(rows) ? (rows as Row[]) : []);

function offered(choices: string[]): string {
  return choices.length === 0 ? "" : `\n\nChoose from: ${choices.join(" | ")}`;
}

function boxes(parts: string[], cap: number): string {
  if (parts.length === 0) return "";
  const listed =
    cap >= 2
      ? `${parts[0] ?? ""}, up to ${cap} of them`
      : parts.map((part) => `- ${part}`).join("\n");
  return `\n\nThe boxes to answer:\n${listed}`;
}

function shown(groups: SampleGroup[]): string {
  return groups.length === 0
    ? ""
    : `\n\nSynthetic example groups from an earlier round (not real class responses):\n${groups.map((group) => `- ${group.name}${group.cards.map((card) => `\n  - ${card}`).join("")}`).join("\n")}`;
}

function standing(piles: StandingPile[]): string {
  return piles.length === 0
    ? "No piles yet."
    : piles
        .map((pile) => `- ${pile.name}${pile.description === "" ? "" : `: ${pile.description}`}`)
        .join("\n");
}

function participants(): string {
  return STANCES.map((stance, index) => `${index + 1}. ${stance}`).join("\n");
}

function passageOf({
  prompt,
  choices,
  parts,
  cap,
  groups,
  piles,
  notes,
}: {
  prompt: string;
  choices: string[];
  parts: string[];
  cap: number;
  groups: SampleGroup[];
  piles: StandingPile[];
  notes: string;
}): string {
  return `${SAMPLING_CONTRACT}\n\nThe question:\n${prompt}${offered(choices)}${boxes(parts, cap)}${shown(groups)}${notesOf(notes)}\n\nThe piles as they stand:\n${standing(piles)}\n\nThe participants, one answer each:\n${participants()}`;
}

/** The passage for a round that takes nothing: its question as written, its standing piles, its note. */
export function samplingPassage({
  prompt,
  choices,
  parts,
  cap,
  piles,
  notes,
}: {
  prompt: unknown;
  choices: unknown;
  parts: unknown;
  cap: unknown;
  piles: unknown;
  notes: unknown;
}): string {
  return passageOf({
    prompt: asString(prompt),
    choices: asStrings(choices),
    parts: asStrings(parts),
    cap: typeof cap === "number" ? cap : 0,
    groups: [],
    piles: asRows<StandingPile>(piles),
    notes: asString(notes),
  });
}

/**
 * The passage for a round that takes from an earlier one: names stand where
 * the take puts them, and their synthetic answers supply the supporting
 * examples shown with context, choices, or boxes in the participant preview.
 */
export function samplingPassageTaking({
  prompt,
  choices,
  parts,
  cap,
  piles,
  notes,
  use,
  carried,
}: {
  prompt: unknown;
  choices: unknown;
  parts: unknown;
  cap: unknown;
  piles: unknown;
  notes: unknown;
  use: unknown;
  carried: unknown;
}): string {
  const groups = asRows<SampleGroup>(carried);
  const names = groups.map((group) => group.name);
  const taking = asString(use);
  return passageOf({
    prompt: asString(prompt),
    choices: taking === "choices" ? names : asStrings(choices),
    parts: taking === "parts" ? names : taking === "choices" ? [] : asStrings(parts),
    cap: taking === "parts" || taking === "choices" ? 0 : typeof cap === "number" ? cap : 0,
    groups: ["context", "choices", "parts"].includes(taking) ? groups : [],
    piles: asRows<StandingPile>(piles),
    notes: asString(notes),
  });
}

/** The names a round takes from a source that has no sample yet: none, so its passage names nothing it could be asked with. */
export function unsampledNames({ use: _use }: { use: unknown }): string[] {
  return [];
}

/** Whether the passage a sample was asked with is the one the round would make now: `fresh`, or `stale`. */
export function sampleStanding({ asked, passage }: { asked: unknown; passage: unknown }): string {
  return asked === passage ? "fresh" : "stale";
}

/** The answers of a sampled reply, each with the pile it was placed in; nothing when the reply cannot be read. */
export function sampledAnswers({ reply }: { reply: unknown }): SampledAnswer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(asString(reply));
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
  const record = parsed as Record<string, unknown>;
  if (record.kind !== "sampled" || !Array.isArray(record.answers)) return [];
  const answers: SampledAnswer[] = [];
  for (const entry of record.answers) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const answer = entry as Record<string, unknown>;
    const value = asString(answer.value).replace(/\s+/g, " ").trim();
    const pile = asString(answer.pile).replace(/\s+/g, " ").trim();
    if (value === "" || pile === "") continue;
    answers.push({ value, pile });
  }
  return answers;
}

/** The piles a sampled reply names, each once, in the order they are first placed in. */
export function sampledPiles({ reply }: { reply: unknown }): string[] {
  const names: string[] = [];
  for (const answer of sampledAnswers({ reply })) {
    if (!names.includes(answer.pile)) names.push(answer.pile);
  }
  return names;
}

/** Synthetic source groups retain each sampled answer in its pile's first-seen order. */
export function sampledGroups({
  reply,
  kind,
  choices,
  use,
}: {
  reply: unknown;
  kind: unknown;
  choices: unknown;
  use: unknown;
}): SampleGroup[] {
  const sourceKind =
    asString(kind) || roundKind({ choices: asStrings(choices), parts: [], use: asString(use) });
  const groups = new Map<string, SampleGroup>();
  for (const answer of sampledAnswers({ reply })) {
    let group = groups.get(answer.pile);
    if (group === undefined) {
      group = { name: answer.pile, cards: [] };
      groups.set(answer.pile, group);
    }
    // Ballots name a choice; they are not the original situation behind it.
    if (sourceKind !== "vote") group.cards.push(answer.value);
  }
  return [...groups.values()];
}

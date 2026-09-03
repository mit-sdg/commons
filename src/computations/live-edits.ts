/**
 * Passages put before the reasoner when a relay is drafted, the reading of what
 * it replies, and the readers that turn one suggestion line back into the
 * values a concept action takes. The contract is the drafting one's sibling:
 * the reasoner answers in JSON mode, one object per reply, and a reply is
 * either the whole relay as it should read afterward or nothing usable.
 */

import {
  normalizeParts,
  normalizeQuestionMaterial,
  normalizeTitle,
  QUESTIONING_LIMITS,
} from "../concepts/questioning/constraints.ts";

/** How many rounds one relay-drafting reply may deliver. */
const ROUNDS = 20;

/** The shapes this composition fills when a round takes from an earlier one. */
const SHAPES = ["picked", "every", "top"];

const CONTRACT = `You revise a relay for a live classroom tool. A relay is a short series of rounds run in one meeting; each round is one question the room answers on phones, and a later round can take what an earlier round produced.
Reply with exactly one JSON object and nothing else.

{"kind":"relay","rounds":[{"title":"...","prompt":"...","parts":[],"cap":0,"choices":[],"takes":{"from":0,"shape":""}}]}
- Deliver the whole relay as it should read afterward, in order, including the rounds you leave unchanged.
- "title" names the round and is 1 to ${QUESTIONING_LIMITS.title} characters; "prompt" is the question the room reads and is 1 to ${QUESTIONING_LIMITS.prompt} characters.
- A round offers "choices" or takes "parts", never both. "choices" are up to ${QUESTIONING_LIMITS.choices} distinct, nonblank options. "parts" are up to ${QUESTIONING_LIMITS.parts} short labels — one box each, with "cap":0 — or one label with a "cap" of 2 to ${QUESTIONING_LIMITS.cap} for one box repeated up to that many times. A round with neither takes one written answer.
- "takes" says what a round carries from an earlier round: "from" is that round's number and "shape" is "picked" (the piles the staff member tapped), "every" (every pile), or "top" (the fullest piles). A round that takes nothing has {"from":0,"shape":""}.
- Deliver 1 to ${ROUNDS} rounds.`;

/** One leg of the relay's plan, as Relaying answers it. */
interface PlanLeg {
  leg?: unknown;
  material?: unknown;
  position?: unknown;
  draws?: unknown;
}

/** One questionnaire, as Questioning answers several of them together. */
interface Material {
  questionnaire?: unknown;
  title?: unknown;
  questions?: unknown;
}

/** What a round takes: the number of the round it takes from, and the shape. */
export interface RoundTakes {
  from: number;
  shape: string;
}

/** One round of a relay as this composition reads and writes it. */
export interface Round {
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
}

/** A round as it stands, tied to the leg the lines address it by. */
interface StandingRound extends Round {
  leg: string;
  number: number;
  takes: RoundTakes;
}

/** One suggestion line, as Suggesting takes them. */
interface Line {
  kind: string;
  target: string;
  value: string;
}

type DraftedRound = Round & { takes: RoundTakes };

type Reading = { kind: "relay"; rounds: DraftedRound[] } | { kind: "neither"; reason: string };

const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry) => typeof entry === "string").map((entry) => entry.trim())
    : [];

const asNumber = (value: unknown): number =>
  typeof value === "number" && Number.isInteger(value) ? value : 0;

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const readJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

const sameStrings = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry === right[index]);

/** The relay as it stands: one round per leg, in position order. */
function standingRounds(legs: unknown, materials: unknown): StandingRound[] {
  const plan = Array.isArray(legs) ? (legs as PlanLeg[]) : [];
  const known = new Map<string, Material>();
  for (const material of Array.isArray(materials) ? (materials as Material[]) : []) {
    known.set(asString(material.questionnaire), material);
  }
  const numbers = new Map<string, number>();
  plan.forEach((leg, index) => numbers.set(asString(leg.leg), index + 1));
  return plan.map((leg, index) => {
    const material = known.get(asString(leg.material));
    const questions = Array.isArray(material?.questions) ? material.questions : [];
    const question = asRecord(questions[0]);
    const draw = asRecord((Array.isArray(leg.draws) ? leg.draws : [])[0]);
    const source = asString(draw.source);
    const shape = asString(draw.shape);
    const from = numbers.get(source) ?? 0;
    return {
      leg: asString(leg.leg),
      number: index + 1,
      title: asString(material?.title),
      prompt: asString(question.prompt),
      parts: asStrings(question.parts),
      cap: asNumber(question.cap),
      choices: asStrings(question.choices),
      takes: from === 0 || shape === "" ? { from: 0, shape: "" } : { from, shape },
    };
  });
}

/** What the reasoner is shown of the relay: its rounds by number, never by identity. */
function standingFace(legs: unknown, materials: unknown) {
  return standingRounds(legs, materials).map(({ leg: _leg, ...round }) => round);
}

function readTakes(value: unknown): RoundTakes | undefined {
  if (value === undefined || value === null) return { from: 0, shape: "" };
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const from = record.from ?? 0;
  const shape = record.shape ?? "";
  if (typeof from !== "number" || !Number.isInteger(from) || from < 0) return undefined;
  if (typeof shape !== "string") return undefined;
  const named = shape.trim();
  if (named !== "" && !SHAPES.includes(named)) return undefined;
  return from === 0 || named === "" ? { from: 0, shape: "" } : { from, shape: named };
}

function parse(reply: string): Reading {
  const parsed = readJson(reply);
  if (parsed === undefined) return { kind: "neither", reason: "The reply was not readable JSON." };
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { kind: "neither", reason: "The reply was not a JSON object." };
  }
  const record = parsed as Record<string, unknown>;
  if (record.kind !== "relay") {
    return { kind: "neither", reason: "The reply named no recognizable kind." };
  }
  if (!Array.isArray(record.rounds) || record.rounds.length === 0) {
    return { kind: "neither", reason: "The relay carried no rounds." };
  }
  if (record.rounds.length > ROUNDS) {
    return { kind: "neither", reason: `The relay carried more than ${ROUNDS} rounds.` };
  }
  const rounds: DraftedRound[] = [];
  for (const entry of record.rounds) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      return { kind: "neither", reason: "A round was not an object." };
    }
    const round = entry as Record<string, unknown>;
    const title = normalizeTitle(round.title);
    if (!title.ok) return { kind: "neither", reason: title.violation.message };
    const material = normalizeQuestionMaterial({
      prompt: round.prompt,
      choices: round.choices ?? [],
      expected: "",
      explanation: "",
    });
    if (!material.ok) return { kind: "neither", reason: material.violation.message };
    const shape = normalizeParts({ parts: round.parts ?? [], cap: round.cap ?? 0 });
    if (!shape.ok) return { kind: "neither", reason: shape.violation.message };
    if (shape.value.parts.length > 0 && material.value.choices.length > 0) {
      return { kind: "neither", reason: "A round offers choices or takes parts, never both." };
    }
    const takes = readTakes(round.takes);
    if (takes === undefined) {
      return {
        kind: "neither",
        reason: 'A round\'s takes needs a round number and a shape of "picked", "every", or "top".',
      };
    }
    rounds.push({
      title: title.value,
      prompt: material.value.prompt,
      choices: material.value.choices,
      parts: shape.value.parts,
      cap: shape.value.cap,
      takes,
    });
  }
  return { kind: "relay", rounds };
}

export function legMaterials({ legs }: { legs: unknown }): string[] {
  return (Array.isArray(legs) ? (legs as PlanLeg[]) : []).map((leg) => asString(leg.material));
}

export function relayDraftPassage({
  request,
  legs,
  materials,
}: {
  request: string;
  legs: unknown;
  materials: unknown;
}): string {
  return `${CONTRACT}\n\nThe relay as it stands:\n${JSON.stringify(standingFace(legs, materials))}\n\nThe brief:\n${request}`;
}

export function relayDraftRepairPassage({
  passage,
  offering,
  account,
}: {
  passage: string;
  offering: string;
  account: string;
}): string {
  return `${passage}\n\nYour previous reply came back unusable. The reply was:\n${offering}\n\nThe account of the problem:\n${account}\n\nDeliver a correct reply this time.`;
}

export function relayDraftReading({ reply }: { reply: string }): string {
  return parse(reply).kind;
}

export function relayDraftReason({ reply }: { reply: string }): string {
  const reading = parse(reply);
  return reading.kind === "neither" ? reading.reason : "";
}

/**
 * The lines that turn the relay as it stands into the drafted one, by position:
 * a round within both reaches keeps its identity and gives one line per changed
 * field, a drafted round past the relay's reach is added, and a round past the
 * draft's reach is removed.
 */
export function relayEditLines({
  reply,
  legs,
  materials,
}: {
  reply: string;
  legs: unknown;
  materials: unknown;
}): Line[] {
  const reading = parse(reply);
  if (reading.kind !== "relay") return [];
  const standing = standingRounds(legs, materials);
  const lines: Line[] = [];
  const reach = Math.max(reading.rounds.length, standing.length);
  for (let index = 0; index < reach; index += 1) {
    const drafted = reading.rounds[index];
    const stands = standing[index];
    if (drafted === undefined) {
      lines.push({ kind: "remove", target: (stands as StandingRound).leg, value: "" });
      continue;
    }
    if (stands === undefined) {
      const { title, prompt, parts, cap, choices } = drafted;
      lines.push({
        kind: "add",
        target: "",
        value: JSON.stringify({ title, prompt, parts, cap, choices }),
      });
      continue;
    }
    if (drafted.title !== stands.title) {
      lines.push({ kind: "title", target: stands.leg, value: drafted.title });
    }
    if (drafted.prompt !== stands.prompt) {
      lines.push({ kind: "prompt", target: stands.leg, value: drafted.prompt });
    }
    if (!sameStrings(drafted.parts, stands.parts) || drafted.cap !== stands.cap) {
      lines.push({
        kind: "parts",
        target: stands.leg,
        value: JSON.stringify({ parts: drafted.parts, cap: drafted.cap }),
      });
    }
    if (!sameStrings(drafted.choices, stands.choices)) {
      lines.push({ kind: "choices", target: stands.leg, value: JSON.stringify(drafted.choices) });
    }
    if (drafted.takes.from !== stands.takes.from || drafted.takes.shape !== stands.takes.shape) {
      lines.push({ kind: "takes", target: stands.leg, value: JSON.stringify(drafted.takes) });
    }
  }
  return lines;
}

export function editRoundJson({ value }: { value: string }): Round {
  const round = asRecord(readJson(value));
  return {
    title: asString(round.title),
    prompt: asString(round.prompt),
    parts: asStrings(round.parts),
    cap: asNumber(round.cap),
    choices: asStrings(round.choices),
  };
}

export function editTitle({ round }: { round: unknown }): string {
  return asString(asRecord(round).title);
}

export function editPrompt({ round }: { round: unknown }): string {
  return asString(asRecord(round).prompt);
}

export function editRoundParts({ round }: { round: unknown }): string[] {
  return asStrings(asRecord(round).parts);
}

export function editRoundCap({ round }: { round: unknown }): number {
  return asNumber(asRecord(round).cap);
}

export function editRoundChoices({ round }: { round: unknown }): string[] {
  return asStrings(asRecord(round).choices);
}

export function editParts({ value }: { value: string }): string[] {
  return asStrings(asRecord(readJson(value)).parts);
}

export function editCap({ value }: { value: string }): number {
  return asNumber(asRecord(readJson(value)).cap);
}

export function editChoices({ value }: { value: string }): string[] {
  return asStrings(readJson(value));
}

/** A `move` line's value is the round's new number; a `takes` line's is what it takes from. */
export function editPosition({ value }: { value: string }): number {
  const read = readJson(value);
  if (typeof read === "number") return asNumber(read);
  const takes = readTakes(read);
  return takes === undefined ? 0 : takes.from;
}

export function editShape({ value }: { value: string }): string {
  const takes = readTakes(readJson(value));
  return takes === undefined ? "" : takes.shape;
}

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
import { CARRY_USES, isCarryUse, type RoundKind, roundKind } from "./live-carries.ts";

/** How many rounds one relay-drafting reply may deliver. */
const ROUNDS = 20;

const KINDS: RoundKind[] = ["write", "list", "vote"];

/** The table of uses as the model reads it: one line per kind. */
const USES_TABLE = KINDS.map(
  (kind) =>
    `  ${kind}: ${CARRY_USES.filter((entry) => entry.kinds.includes(kind))
      .map((entry) => `"${entry.use}"`)
      .join(", ")}`,
).join("\n");

const CONTRACT = `You revise a relay for a live classroom tool. A relay is a short series of rounds run in one meeting; each round is one question the room answers on phones. Every round leaves named groups on the wall — piles of written answers, or the choices of a vote with their counts — and a later round can take the groups the staff member picks from an earlier round.
Reply with exactly one JSON object and nothing else.

{"kind":"relay","rounds":[{"number":1,"kind":"write","title":"...","prompt":"...","parts":[],"cap":0,"choices":[],"takes":{"from":0,"use":""}}]}
- Deliver the whole relay as it should read afterward, in order, including the rounds you leave unchanged. A brief that asks for nothing is answered with the relay exactly as it stands, and a brief that asks to clear the relay with "rounds":[]. A brief that asks for what these rules cannot say — a quiz with right answers, a round taking from a later one, a title or a box count past its limit — is met as far as the rules reach and no further: the impossible part is left undone, never forced through by cutting a take, inventing choices, or rewriting a round; a brief of one word or a request for many rounds is an ordinary brief, answered in full.
- "number" is the round's number in the relay as it stands, so a round you keep, rename, or move keeps its number wherever it lands; a round you add has "number":0. Never give two rounds the same standing number.
- "title" names the round in two or three words and is 1 to ${QUESTIONING_LIMITS.title} characters, never numbered ("Week 1", "Q3"): the relay numbers its rounds itself. "prompt" is the one question the room reads on a phone, 1 to ${QUESTIONING_LIMITS.prompt} characters, in the staff member's own blunt voice: no greeting, no lead-in, no "please" or "reflect on", nothing before the question. A relay has no right answers: never mark a correct choice and never put an answer or an explanation in a prompt.
- A round's "kind" is "write" (one written answer; "parts":[] and "choices":[]), "list" (several written answers: "parts" are up to ${QUESTIONING_LIMITS.parts} short distinct labels, one box each with "cap":0, or one label with a "cap" of 2 to ${QUESTIONING_LIMITS.cap} for one box repeated; "choices":[]), or "vote" ("choices" are 2 to ${QUESTIONING_LIMITS.choices} distinct, nonblank options the brief names or the question plainly implies; "parts":[]). A round may change kind when the brief asks; a vote that loses its choices and takes none becomes a write round, never a vote with made-up choices.
- "takes" says what a round does with the groups picked from an earlier round: "from" is that round's number in the relay you deliver, and "use" is one of the uses open to the round's kind:
${USES_TABLE}
  "context" shows the picked groups above the prompt; "choices" makes them the vote's choices, so give that round "choices":[]; "parts" makes them the boxes, so give that round "parts":[]. A round that takes nothing has {"from":0,"use":""}. A round takes only from a round before it. Never invent placeholder choices or parts, for what a round takes or for anything else.
- Deliver at most ${ROUNDS} rounds.`;

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

type DraftedRound = Round & { takes: RoundTakes; number: number };

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
  return standingRounds(legs, materials).map(({ leg: _leg, takes, ...round }) => ({
    number: round.number,
    kind: roundKind({ choices: round.choices, parts: round.parts, use: takes.shape }),
    title: round.title,
    prompt: round.prompt,
    parts: round.parts,
    cap: round.cap,
    choices: round.choices,
    takes: { from: takes.from, use: takes.shape },
  }));
}

/** A take as the model writes it (`use`) or as a line carries it (`shape`); the two are one word. */
function readTakes(value: unknown): RoundTakes | undefined {
  if (value === undefined || value === null) return { from: 0, shape: "" };
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const from = record.from ?? 0;
  const shape = record.use ?? record.shape ?? "";
  if (typeof from !== "number" || !Number.isInteger(from) || from < 0) return undefined;
  if (typeof shape !== "string") return undefined;
  const named = shape.trim();
  if (named !== "" && !isCarryUse(named)) return undefined;
  return from === 0 || named === "" ? { from: 0, shape: "" } : { from, shape: named };
}

/** The kind a drafted round claims, or the one its boxes and take imply when it claims none. */
function readKind(
  value: unknown,
  round: { parts: string[]; choices: string[]; takes: RoundTakes },
): RoundKind | undefined {
  if (value === undefined || value === null || value === "") {
    return roundKind({ choices: round.choices, parts: round.parts, use: round.takes.shape });
  }
  return typeof value === "string" && (KINDS as string[]).includes(value)
    ? (value as RoundKind)
    : undefined;
}

/** Why a round's boxes, choices, and take do not fit its kind, or nothing when they do. */
function misfit(kind: RoundKind, round: { parts: string[]; choices: string[]; takes: RoundTakes }) {
  const use = round.takes.shape;
  if (use !== "" && !CARRY_USES.some((entry) => entry.use === use && entry.kinds.includes(kind))) {
    return `A ${kind} round cannot take "${use}".`;
  }
  if (kind === "write" && (round.parts.length > 0 || round.choices.length > 0)) {
    return "A write round has no parts and no choices.";
  }
  if (kind === "list" && round.choices.length > 0) return "A list round has no choices.";
  if (kind === "list" && round.parts.length === 0 && use !== "parts") {
    return "A list round needs parts, or takes them.";
  }
  if (kind === "vote" && round.parts.length > 0) return "A vote round has no parts.";
  if (kind === "vote" && round.choices.length === 0 && use !== "choices") {
    return "A vote round needs choices, or takes them.";
  }
  if (use === "choices" && round.choices.length > 0) {
    return "A round that takes its choices delivers none of its own.";
  }
  if (use === "parts" && round.parts.length > 0) {
    return "A round that takes its parts delivers none of its own.";
  }
  return "";
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
  if (!Array.isArray(record.rounds)) {
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
    const takes = readTakes(round.takes);
    if (takes === undefined) {
      return {
        kind: "neither",
        reason:
          'A round\'s takes needs a round number and a use of "context", "choices", or "parts".',
      };
    }
    const fitted = { parts: shape.value.parts, choices: material.value.choices, takes };
    const kind = readKind(round.kind, fitted);
    if (kind === undefined) {
      return { kind: "neither", reason: 'A round\'s kind is "write", "list", or "vote".' };
    }
    const wrong = misfit(kind, fitted);
    if (wrong !== "") return { kind: "neither", reason: wrong };
    rounds.push({
      number: Math.max(0, asNumber(round.number)),
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

/** The lines that change one kept round's fields to the drafted ones. */
function fieldLines(stands: StandingRound, drafted: DraftedRound): Line[] {
  const lines: Line[] = [];
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
  return lines;
}

const sameTakes = (left: RoundTakes, right: RoundTakes) =>
  left.from === right.from && left.shape === right.shape;

/** An `add` line's value: the round, what it takes, and the number it lands at. */
function addLine(drafted: DraftedRound, position: number): Line {
  const { title, prompt, parts, cap, choices, takes } = drafted;
  const kind = roundKind({ choices, parts, use: takes.shape });
  return {
    kind: "add",
    target: "",
    value: JSON.stringify({ kind, title, prompt, parts, cap, choices, takes, position }),
  };
}

/** The keep line: the one line offered when the draft leaves the relay as it stands. */
const KEEP: Line = { kind: "keep", target: "", value: "" };

/**
 * The lines that turn the relay as it stands into the drafted one. A drafted
 * round that carries a standing number keeps that round's identity: its fields
 * give one line each, a round it lands away from gives a `move`, a standing
 * round no drafted round names is removed, and a round numbered 0 is added at
 * the position it lands, carrying its takes. Lines are ordered so each is
 * applied against the relay the earlier lines have made: takes cleared (off a
 * source that goes, or off a round that no longer takes), removes, field
 * edits, moves, adds, then the takes that remain, whose round numbers are the
 * delivered relay's. A reply that numbers
 * no round is read by position, as a draft over an empty relay is.
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
  const numbered = reading.rounds.some((round) => round.number > 0);
  const lines = numbered
    ? linesByIdentity(standing, reading.rounds)
    : linesByPosition(standing, reading.rounds);
  return lines.length === 0 ? [KEEP] : lines;
}

function linesByPosition(standing: StandingRound[], drafted: DraftedRound[]): Line[] {
  const lines: Line[] = [];
  const reach = Math.max(drafted.length, standing.length);
  for (let index = 0; index < reach; index += 1) {
    const round = drafted[index];
    const stands = standing[index];
    if (round === undefined) {
      lines.push({ kind: "remove", target: (stands as StandingRound).leg, value: "" });
      continue;
    }
    if (stands === undefined) {
      lines.push(addLine(round, index + 1));
      continue;
    }
    lines.push(...fieldLines(stands, round));
    if (!sameTakes(round.takes, stands.takes)) {
      lines.push({ kind: "takes", target: stands.leg, value: JSON.stringify(round.takes) });
    }
  }
  return lines;
}

function linesByIdentity(standing: StandingRound[], drafted: DraftedRound[]): Line[] {
  const byNumber = new Map(standing.map((round) => [round.number, round]));
  const claimed = new Set<string>();
  const paired = drafted.map((round) => {
    const stands = round.number > 0 ? byNumber.get(round.number) : undefined;
    if (stands === undefined || claimed.has(stands.leg)) return { round, stands: undefined };
    claimed.add(stands.leg);
    return { round, stands };
  });
  const removed = standing.filter((round) => !claimed.has(round.leg));
  const removedNumbers = new Set(removed.map((round) => round.number));

  const lines: Line[] = [];
  // Takes cleared first: off a source that goes, so it can be removed, and off
  // a round that no longer takes, so it may move above what it took from.
  const cleared = new Set<string>();
  for (const { round, stands } of paired) {
    if (stands === undefined || stands.takes.from === 0) continue;
    if (removedNumbers.has(stands.takes.from) || round.takes.from === 0) {
      cleared.add(stands.leg);
      lines.push({
        kind: "takes",
        target: stands.leg,
        value: JSON.stringify({ from: 0, shape: "" }),
      });
    }
  }
  for (const round of removed) lines.push({ kind: "remove", target: round.leg, value: "" });
  for (const { round, stands } of paired) {
    if (stands !== undefined) lines.push(...fieldLines(stands, round));
  }
  // Moves: the kept rounds walked into the drafted order, one move per round out of place.
  const kept = standing.filter((round) => claimed.has(round.leg)).map((round) => round.leg);
  const wanted = paired.flatMap(({ stands }) => (stands === undefined ? [] : [stands.leg]));
  for (let index = 0; index < wanted.length; index += 1) {
    const leg = wanted[index] as string;
    if (kept[index] === leg) continue;
    kept.splice(kept.indexOf(leg), 1);
    kept.splice(index, 0, leg);
    lines.push({ kind: "move", target: leg, value: String(index + 1) });
  }
  // Adds land at their delivered numbers, carrying their takes.
  paired.forEach(({ round, stands }, index) => {
    if (stands === undefined) lines.push(addLine(round, index + 1));
  });
  // The takes that remain, against the delivered relay's numbering.
  for (const { round, stands } of paired) {
    if (stands === undefined) continue;
    const before = cleared.has(stands.leg) ? { from: 0, shape: "" } : stands.takes;
    if (!sameTakes(round.takes, before)) {
      lines.push({ kind: "takes", target: stands.leg, value: JSON.stringify(round.takes) });
    }
  }
  return lines;
}

export function editRoundJson({
  value,
}: {
  value: string;
}): Round & { takes: RoundTakes; position: number } {
  const round = asRecord(readJson(value));
  return {
    title: asString(round.title),
    prompt: asString(round.prompt),
    parts: asStrings(round.parts),
    cap: asNumber(round.cap),
    choices: asStrings(round.choices),
    takes: readTakes(round.takes) ?? { from: 0, shape: "" },
    position: asNumber(round.position),
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

/** The number of the round an added round takes from, and 0 when it takes nothing. */
export function editRoundTakesFrom({ round }: { round: unknown }): number {
  const takes = readTakes(asRecord(round).takes);
  return takes === undefined ? 0 : takes.from;
}

export function editRoundTakesShape({ round }: { round: unknown }): string {
  const takes = readTakes(asRecord(round).takes);
  return takes === undefined ? "" : takes.shape;
}

/** The number an added round lands at, and 0 when it simply goes last. */
export function editRoundPosition({ round }: { round: unknown }): number {
  return asNumber(asRecord(round).position);
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

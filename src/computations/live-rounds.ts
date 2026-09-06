/**
 * The small calculations the relay and wall compositions share: card
 * identities and a round's shape.
 */

import { createHash } from "node:crypto";

/** A card names neither its response nor its item; the wall keeps the join. */
export function cardId({ response, item }: { response: string; item: string }): string {
  return createHash("sha256").update(`${response}/${item}`).digest("hex").slice(0, 32);
}

/** A round that offers carried choices is one box: no parts. */
export function oneBoxParts({ question: _question }: { question: string }): string[] {
  return [];
}

export function oneBoxCap({ question: _question }: { question: string }): number {
  return 0;
}

/** A round that takes its parts offers no choices. */
export function noChoices({ question: _question }: { question: string }): string[] {
  return [];
}

/**
 * The choices a round puts before the room: its own when the leg's word is
 * `vote` or the leg has no word, and none under `write` or `list`. The kind
 * is a selector: what was written for the other kinds stays on the question
 * and is only left out of the presentation.
 */
export function kindChoices({ kind, choices }: { kind: string; choices: string[] }): string[] {
  return kind === "write" || kind === "list" ? [] : choices;
}

/** The parts a round puts before the room: its own under `list` or no word, none under `write` or `vote`. */
export function kindParts({ kind, parts }: { kind: string; parts: string[] }): string[] {
  return kind === "write" || kind === "vote" ? [] : parts;
}

/** The cap that goes with the parts: the round's own under `list` or no word, none otherwise. */
export function kindCap({ kind, cap }: { kind: string; cap: number }): number {
  return kind === "write" || kind === "vote" ? 0 : cap;
}

export function isSame({ left, right }: { left: string; right: string }): boolean {
  return left === right;
}

/**
 * The small calculations the relay and wall compositions share: card
 * identities and the model participant's mark.
 */

import { createHash } from "node:crypto";

const MODEL_PREFIX = "model:";

/** A card names neither its response nor its item; the wall keeps the join. */
export function cardId({ response, item }: { response: string; item: string }): string {
  return createHash("sha256").update(`${response}/${item}`).digest("hex").slice(0, 32);
}

export function isModelParticipant({ participant }: { participant: string }): boolean {
  return participant.startsWith(MODEL_PREFIX);
}

export function modelParticipant({ device }: { device: string }): string {
  return `${MODEL_PREFIX}${device}`;
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

export function isSame({ left, right }: { left: string; right: string }): boolean {
  return left === right;
}

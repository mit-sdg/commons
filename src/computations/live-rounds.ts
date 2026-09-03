/**
 * The small calculations the relay and wall compositions share: card
 * identities, the model participant's mark, and what a round carries out of
 * a wall when it takes every pile or the fullest few.
 */

import { createHash } from "node:crypto";

const MODEL_PREFIX = "model:";

interface PileWithItems {
  category: string;
  name: string;
  description: string;
  items: string[];
}

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

export function isSame({ left, right }: { left: string; right: string }): boolean {
  return left === right;
}

export function everyPile({ categories }: { categories: PileWithItems[] }): string[] {
  return categories.map((pile) => pile.category);
}

/** The three fullest piles, fullest first; ties keep the wall's creation order. */
export function topPiles({ categories }: { categories: PileWithItems[] }): string[] {
  return [...categories]
    .map((pile, index) => ({ pile, index }))
    .sort(
      (left, right) => right.pile.items.length - left.pile.items.length || left.index - right.index,
    )
    .slice(0, 3)
    .map(({ pile }) => pile.category);
}

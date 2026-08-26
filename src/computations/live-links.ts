/**
 * Linking keeps a sequence of targets, and a drafting line links exactly one
 * questionnaire — the one it refines or composed — so the sequence is always
 * this singleton.
 */

export function soleTarget({ target }: { target: string }): string[] {
  return [target];
}

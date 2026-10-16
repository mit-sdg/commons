/**
 * Indexes a concept keeps only for speed: its queries answer the same without them. They are
 * built once, on the concept's first call. A build that fails is logged, and the concept reads
 * without them until the next restart, so a failed build never fails a request. A unique index
 * enforces what a concept stores, so it is not a speed index and fails loudly instead.
 */
export function speedIndexes(
  concept: string,
  build: () => Promise<unknown>,
  warn: (line: string) => void = (line) => console.warn(line),
): () => Promise<void> {
  let built: Promise<void> | undefined;
  return () =>
    (built ??= build().then(
      () => undefined,
      (error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error);
        warn(`commons: ${concept} could not build its indexes and reads without them: ${reason}`);
      },
    ));
}

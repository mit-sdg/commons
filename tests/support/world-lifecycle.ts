/** Kept lightweight so concept-only files need not import the application graph. */
export const pooledLifecycle = { release: undefined as (() => Promise<void>) | undefined };

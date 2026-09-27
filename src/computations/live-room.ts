/** How recently a device must have been heard to count as here. */
const HERE_MS = 60_000;

export function roomSince({ at }: { at: Date }): Date {
  return new Date(at.getTime() - HERE_MS);
}

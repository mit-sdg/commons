/**
 * The two lines a phone says about itself: who is holding it, and what the
 * wall still has unsorted once it has handed in.
 */

/** Who holds this phone: the name it signed in under, or how it arrived. */
export function identityLine(
  displayName: string | null,
  by: string | null,
): string {
  if (displayName !== null && displayName !== "") return displayName;
  return by === "code" ? "Joined by code" : "Anonymous";
}

/** What the tray holds, and whether a card of this phone's is still in it. */
export function trayLine(count: number, minePending: boolean): string | null {
  if (count <= 0) return null;
  return minePending
    ? `${count} in the tray, including yours`
    : `${count} in the tray`;
}

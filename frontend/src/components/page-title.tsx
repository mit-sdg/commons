"use client";

/** The longest a piece of a tab title runs before it is cut short. */
const LONGEST = 60;

function clipped(part: string): string {
  const text = part.replace(/\s+/g, " ").trim();
  return text.length > LONGEST ? `${text.slice(0, LONGEST).trimEnd()}…` : text;
}

/**
 * The browser tab's title, from the most particular part to the least, ending
 * in the application's name: "Which editor? | Discussions | Commons". A page
 * still loading names only what it already knows; the parts it lacks are
 * skipped.
 */
export function tabTitle(
  parts: readonly (string | null | undefined)[],
): string {
  return [
    ...parts.filter((p): p is string => !!p?.trim()).map(clipped),
    "Commons",
  ].join(" | ");
}

export function PageTitle({
  parts,
}: {
  parts: readonly (string | null | undefined)[];
}) {
  // React hoists a rendered <title> into the head, ahead of the metadata's.
  return <title>{tabTitle(parts)}</title>;
}

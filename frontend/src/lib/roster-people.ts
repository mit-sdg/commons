/**
 * What the roster page knows about an address before it adds anybody.
 *
 * Adding one person reaches the same import a one-row CSV reaches, so the
 * answers are the same: an address that already carries an active or dropped
 * seat is refused, and a still-pending seat is refreshed rather than doubled.
 * The page has all three lists loaded, so it can name which of those it is
 * looking at instead of reporting a bare conflict.
 */
export type SeatStanding = "ACTIVE" | "PENDING" | "DROPPED" | "NONE";

/** Addresses match trimmed and lower-cased, as the roster matches them. */
function sameAddress(one: string, other: string): boolean {
  return one.trim().toLowerCase() === other.trim().toLowerCase();
}

export function seatStandingAt(
  email: string,
  seats: {
    active: readonly string[];
    pending: readonly string[];
    dropped: readonly string[];
  },
): SeatStanding {
  const holds = (addresses: readonly string[]) =>
    addresses.some((address) => sameAddress(address, email));
  if (holds(seats.active)) return "ACTIVE";
  if (holds(seats.dropped)) return "DROPPED";
  if (holds(seats.pending)) return "PENDING";
  return "NONE";
}

/**
 * The kinds a seat is created with. Kind is an opaque string to the roster, so
 * the form offers the two Commons uses plus whatever the roster already holds,
 * rather than pretending to know the whole vocabulary.
 */
export const SEAT_KINDS = ["STUDENT", "STAFF"] as const;

export function seatKindOptions(kinds: readonly string[]): string[] {
  const seen = new Set<string>(SEAT_KINDS);
  const extra = [...new Set(kinds.map((kind) => kind.trim()))]
    .filter((kind) => kind !== "" && !seen.has(kind))
    .sort((one, other) => one.localeCompare(other));
  return [...SEAT_KINDS, ...extra];
}

/**
 * The home page's "add yourself" affordance carries the intent, not the person.
 *
 * The roster page reads the caller's address and display name from the session
 * it already holds, so nothing about them travels in a URL and a link somebody
 * shares adds nobody: it opens the same form, filled in for whoever follows it.
 */
export const SELF_ADD_PARAM = "add";
const SELF_ADD_VALUE = "self";
export const SELF_ADD_HREF = `/staff/roster?${SELF_ADD_PARAM}=${SELF_ADD_VALUE}`;

export function isSelfAddRequest(value: string | null): boolean {
  return value === SELF_ADD_VALUE;
}

import { publicErrorMessage } from "@/lib/api";
import type { SeatStanding } from "@/lib/roster-people";

/**
 * The sentences the class settings and seat removal surfaces show.
 *
 * The edge projects domain refusals onto HTTP codes — `CLASS_NOT_CONFIGURED`
 * and `CLASS_ALREADY_CONFIGURED` both arrive as `CONFLICT`, and
 * `SEAT_NOT_FOUND` as `NOT_FOUND` — so which refusal it was depends on what the
 * caller was doing. Keeping that reading here keeps it out of the components
 * and lets it be read on its own.
 */

/**
 * `configured` is whether the form was revising an existing class; if it was,
 * a conflict means the class is gone, and if it was not, it means one already
 * exists.
 */
export function classSettingsRefusal(
  error: string,
  configured: boolean,
): string {
  if (error !== "CONFLICT") return publicErrorMessage(error);
  return configured
    ? "This deployment has no class configured, so there was nothing to revise. Set the class up below."
    : "A class is already configured for this deployment. Its current details are shown below.";
}

/** Naming the freed address is the useful part: it can be enrolled again. */
export function seatRemovedMessage(email: string): string {
  return `Seat removed. ${email} is free to enrol again.`;
}

export function seatRemovalRefusal(error: string): string {
  return error === "NOT_FOUND"
    ? "That seat is no longer on the roster. It may have been removed already."
    : publicErrorMessage(error);
}

/** What adding one person answered: whether a seat was created, and what the
 * address resolved to while the request was still running. Neither the claim
 * nor the invitation had run yet, so the sentence says what was seen and never
 * what followed; the refreshed rosters are the durable answer. */
export interface AddedPerson {
  created: boolean;
  account: "LIVE" | "ARCHIVED" | "NONE";
}

function accountReading(
  account: AddedPerson["account"],
  email: string,
): string {
  switch (account) {
    case "LIVE":
      return `Added ${email}.`;
    case "ARCHIVED":
      return `${email} has an archived account. Restore it to complete enrollment.`;
    default:
      return `Invitation queued for ${email}.`;
  }
}

/**
 * `keptSettings` is whether a seat was already standing with a kind or section
 * other than the one the form carried: a standing seat keeps what it was
 * created with, and only its name is refreshed, which is worth saying when the
 * form said something different.
 */
export function addedPersonMessage(
  outcome: AddedPerson,
  email: string,
  keptSettings = false,
): string {
  const reading = accountReading(outcome.account, email);
  if (outcome.created) return reading;
  const standing = `Updated the pending seat for ${email}.`;
  const kept = keptSettings ? " Its existing kind and section were kept." : "";
  return `${standing} ${reading}${kept}`;
}

/**
 * A conflict here is a seat already standing at the address. Which seat it is
 * decides the repair, and the page has the rosters loaded to tell.
 */
export function addPersonRefusal(
  error: string,
  {
    email,
    standing,
    section,
  }: { email: string; standing: SeatStanding; section: boolean },
): string {
  if (error === "CONFLICT") {
    if (standing === "ACTIVE")
      return `${email} is already active. Use Active to change or drop the seat.`;
    if (standing === "DROPPED")
      return `${email} has a dropped seat. Reinstate it from Dropped.`;
    return `A seat already exists for ${email}. Check Active or Dropped.`;
  }
  if (error === "NOT_FOUND" && section)
    return "That section no longer exists. Choose another or leave it blank.";
  if (error === "INVALID_REQUEST") return "Enter a valid email address.";
  return publicErrorMessage(error);
}

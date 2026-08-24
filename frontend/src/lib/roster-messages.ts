import { publicErrorMessage } from "@/lib/api";

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

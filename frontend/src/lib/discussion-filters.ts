export type DiscussionFilter = "all" | "everyone" | "private" | "staff";

/** Filters apply only after the server has admitted the reader. */
export function matchesDiscussionAudience(
  audience: ReadonlyArray<{ holder: string }>,
  filter: DiscussionFilter,
  addressedTo = "",
): boolean {
  const includes = (holder: string) =>
    audience.some((entry) => entry.holder === holder);
  if (addressedTo && !includes(addressedTo)) return false;
  const everyone = includes("standing:everyone");
  switch (filter) {
    case "all":
      return true;
    case "everyone":
      return everyone;
    case "private":
      return !everyone;
    case "staff":
      return !everyone && includes("standing:staff");
  }
}

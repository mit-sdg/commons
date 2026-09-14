/** Live holders are interpreted here, independently of forum audiences. */
export function liveAccessHolders({ requireSignIn }: { requireSignIn: boolean }): string[] {
  return [requireSignIn ? "standing:authenticated" : "standing:everyone"];
}

/** Absence preserves legacy runs; an established but unusable policy fails closed. */
export function liveAccessMode({
  holders,
  retired,
}: {
  holders: unknown;
  retired: boolean;
}): string {
  if (retired) return "unavailable";
  if (holders === null || holders === undefined) return "open";
  if (!Array.isArray(holders) || holders.length !== 1) return "unavailable";
  if (holders[0] === "standing:everyone") return "open";
  return holders[0] === "standing:authenticated" ? "signed" : "unavailable";
}

export function liveRequiresSignIn({ mode }: { mode: string }): boolean {
  return mode === "signed";
}

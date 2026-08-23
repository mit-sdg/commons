import {
  ADMINISTER,
  ALL_CAPABILITIES,
  CAPABILITY_NAMES,
} from "../compositions/access/capabilities.ts";

const known = new Set<string>(CAPABILITY_NAMES);

/**
 * Does every requested capability appear in the registry?
 *
 * Role definition runs this first so a mistyped capability is refused outright
 * rather than stored as a permanently inert string.
 */
export async function capabilitiesAreKnown({
  capabilities,
}: {
  capabilities: string[];
}): Promise<boolean> {
  if (!Array.isArray(capabilities)) return false;
  return capabilities.every((capability) => known.has(capability));
}

/**
 * Expand a role's stored capabilities into everything it actually reaches.
 *
 * `administer` is a wildcard, so an administrator's effective set is the whole
 * registry. Expanding here keeps the browser and the endpoints that enforce
 * policy reading the same answer.
 */
export async function effectiveCapabilities({
  capabilities,
}: {
  capabilities: string[];
}): Promise<string[]> {
  if (!Array.isArray(capabilities)) return [];
  return capabilities.includes(ADMINISTER) ? [...ALL_CAPABILITIES] : [...capabilities];
}

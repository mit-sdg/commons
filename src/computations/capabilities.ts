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
 * Does this stored capability set carry the `administer` wildcard?
 *
 * Role editing runs this on the role's current capabilities: the built-in
 * administrator role is the only one that holds the wildcard, and rewriting it
 * through the registry-checked path would strip the wildcard and lock every
 * administrator out.
 */
export async function carriesAdminister({
  capabilities,
}: {
  capabilities: string[];
}): Promise<boolean> {
  return Array.isArray(capabilities) && capabilities.includes(ADMINISTER);
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

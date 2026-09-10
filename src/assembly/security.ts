const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// These browser-supplied values are stored and later read as text. The endpoint
// contracts check presence, not runtime types; reject bad values before writing.
const TEXT_WRITE_FIELDS: Record<string, readonly string[]> = {
  "/auth/accept-invitation": ["username", "displayName"],
  "/setup/register-admin": ["username", "displayName"],
  "/profiles/setDisplayName": ["displayName"],
  "/profiles/setBio": ["bio"],
  "/profiles/setAvatar": ["avatar"],
  "/threads/create": ["content"],
  "/threads/reply": ["content"],
  "/posts/edit": ["content"],
  "/assignments/submit": ["content"],
  "/tags/create": ["name"],
  "/reactions/add": ["kind"],
  "/flags/raise": ["reason"],
  "/tasklists/create": ["title"],
  "/tasklists/rename": ["title"],
  "/tasks/create": ["title", "details"],
  "/tasks/describe": ["title", "details"],
  "/mail/save-template": ["subject", "body"],
  "/mail/preview-template": ["subject", "body"],
};

export function hasTextWriteInputs(path: string, input: unknown): boolean {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return false;
  const fields = TEXT_WRITE_FIELDS[path] ?? [];
  const body = input as Record<string, unknown>;
  // Missing fields still follow each endpoint's required/default rules.
  return fields.every((field) => !(field in body) || typeof body[field] === "string");
}

/**
 * How deep a request body may nest. Commons' own bodies are a few levels; a
 * caller sending more is not describing an operation Commons has. The bound is
 * stated rather than left to the recursion's own limit, so what is rejected
 * does not depend on how much stack happens to be left.
 */
const MAX_DEPTH = 64;

export function hasSafeKeys(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false;
  // The child call is written out: passing this function to `every` directly
  // would hand it the array index as the depth.
  if (Array.isArray(value)) return value.every((child) => hasSafeKeys(child, depth + 1));
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, child]) =>
      !key.startsWith("$") &&
      !key.includes(".") &&
      !RESERVED_KEYS.has(key) &&
      hasSafeKeys(child, depth + 1),
  );
}

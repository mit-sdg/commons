const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

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

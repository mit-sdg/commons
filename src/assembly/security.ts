const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function hasSafeKeys(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(hasSafeKeys);
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, child]) =>
      !key.startsWith("$") && !key.includes(".") && !RESERVED_KEYS.has(key) && hasSafeKeys(child),
  );
}

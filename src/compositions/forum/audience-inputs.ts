export function audiencePreviewInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const input = value as Record<string, unknown>;
  return {
    ok:
      Object.keys(input).length === 2 &&
      typeof input.session === "string" &&
      input.session.length > 0 &&
      input.session.length <= 256 &&
      Array.isArray(input.holders) &&
      input.holders.length > 0 &&
      input.holders.length <= 64 &&
      input.holders.every(
        (holder) => typeof holder === "string" && holder.length > 0 && holder.length <= 256,
      ) &&
      new Set(input.holders).size === input.holders.length,
  };
}

export function createThreadInput(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("session" in value) ||
    !("holders" in value) ||
    Object.keys(value).length !== 3
  )
    return { ok: false };
  const result = audiencePreviewInput({ session: value.session, holders: value.holders });
  if (!result.ok) return result;
  if (
    typeof value !== "object" ||
    value === null ||
    !("content" in value) ||
    typeof value.content !== "string"
  )
    return { ok: false as const, message: "Content is required." };
  return { ok: true as const, value };
}

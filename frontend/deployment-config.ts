export function allowedDevOriginsFromPublicOrigin(
  publicOrigin: string | undefined,
): string[] {
  if (publicOrigin === undefined) return [];

  const hostname = new URL(publicOrigin).hostname;
  if (hostname === "" || hostname.includes("*")) {
    throw new Error("commons: PUBLIC_ORIGIN must contain an exact hostname.");
  }
  return [hostname];
}

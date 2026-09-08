export function allowedDevOriginsFromPublicOrigin(
  ...origins: (string | undefined)[]
): string[] {
  const hostnames: string[] = [];
  for (const origin of origins) {
    if (origin === undefined || origin === "") continue;
    const hostname = new URL(origin).hostname;
    if (hostname === "" || hostname.includes("*")) {
      throw new Error("commons: PUBLIC_ORIGIN and PARTICIPANT_ORIGIN must contain an exact hostname.");
    }
    if (!hostnames.includes(hostname)) hostnames.push(hostname);
  }
  return hostnames;
}

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/setup",
  "/forgot-password",
  "/reset-password",
]);

/** Participant join pages are reachable from a scanned code, with no account. */
const PUBLIC_PREFIXES = ["/q/"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/join",
]);

/**
 * Participant join pages are reachable from a scanned code, with no account;
 * the lab pages run with no server at all.
 */
const PUBLIC_PREFIXES = ["/q/", "/lab/"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

const PUBLIC_PATHS = new Set([
  "/login",
  "/register",
  "/setup",
  "/forgot-password",
  "/reset-password",
]);

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

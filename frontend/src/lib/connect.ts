/**
 * What an app hands back to itself through Commons: opaque to Commons, and
 * checked by the app when the browser returns. Its form is part of the
 * contract apps are written against.
 */
const STATE = /^[A-Za-z0-9._~-]{16,256}$/;

export function isConnectState(value: string): boolean {
  return STATE.test(value);
}

/**
 * The app and state a sign-in request names, or null when either is missing,
 * repeated, or the state is not one an app could have made. Commons checks
 * the app itself; the page never sends the browser anywhere it has not.
 */
export function connectRequest(
  params: Pick<URLSearchParams, "getAll">,
): { app: string; state: string } | null {
  const apps = params.getAll("app");
  const states = params.getAll("state");
  if (apps.length !== 1 || states.length !== 1) return null;
  const [app] = apps as [string];
  const [state] = states as [string];
  return app !== "" && isConnectState(state) ? { app, state } : null;
}

/** Where the browser goes when the person allowed the app. */
export function approvedCallback(
  callback: string,
  code: string,
  state: string,
): string {
  return `${callback}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
}

/** Where the browser goes when the person declined. */
export function deniedCallback(callback: string, state: string): string {
  return `${callback}?error=access_denied&state=${encodeURIComponent(state)}`;
}

/** The host a connected app is shown by: an app is always a bare origin. */
export function appHost(app: string): string {
  const separator = app.indexOf("://");
  return separator === -1 ? app : app.slice(separator + 3);
}

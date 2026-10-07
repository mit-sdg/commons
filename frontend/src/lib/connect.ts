/**
 * What an app hands back to itself through Commons: opaque to Commons, and
 * checked by the app when the browser returns. Its form is part of the
 * contract apps are written against.
 */
const STATE = /^[A-Za-z0-9._~-]{16,256}$/;

export function isConnectState(value: string): boolean {
  return STATE.test(value);
}

/** An S256 challenge: the unpadded base64url SHA-256 of the app's verifier. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

/** The challenge a sign-in request carries, in the fields Commons reads. */
export type ConnectChallenge = {
  code_challenge: string;
  code_challenge_method: "S256";
};

/**
 * The app, state, and challenge a sign-in request names, or null when the app
 * or state is missing, any of them is repeated, the state is not one an app
 * could have made, or the challenge is malformed or not `S256`. A request
 * without a challenge passes here; Commons decides whether its app may ask
 * without one. The page never sends the browser anywhere Commons has not
 * accepted.
 */
export function connectRequest(params: Pick<URLSearchParams, "getAll">): {
  app: string;
  state: string;
  challenge: ConnectChallenge | null;
} | null {
  const apps = params.getAll("app");
  const states = params.getAll("state");
  const challenges = params.getAll("code_challenge");
  const methods = params.getAll("code_challenge_method");
  if (apps.length !== 1 || states.length !== 1) return null;
  if (challenges.length > 1 || methods.length > 1) return null;
  const [app] = apps as [string];
  const [state] = states as [string];
  if (app === "" || !isConnectState(state)) return null;
  const [challenge] = challenges;
  const [method] = methods;
  if (challenge === undefined && method === undefined)
    return { app, state, challenge: null };
  if (
    challenge === undefined ||
    !CHALLENGE.test(challenge) ||
    method !== "S256"
  )
    return null;
  return {
    app,
    state,
    challenge: { code_challenge: challenge, code_challenge_method: "S256" },
  };
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

import { createHash } from "node:crypto";
import {
  configuredConnectAppDomain,
  configuredPublicOrigin,
  HOSTNAME_LABEL,
} from "../deployment.ts";

// An app redeems a code from its callback the moment the browser arrives
// there; a minute covers one redirect and one server call with room to spare.
const CODE_VALIDITY_MS = 60 * 1000;

/** An app on this machine, for development: loopback, plain http, an explicit port. */
const LOOPBACK_APP = /^http:\/\/(?:localhost|127\.0\.0\.1):([1-9][0-9]{0,4})$/;

/** A voucher and its credential joined by one dot, as `connectCode` writes them. */
const CODE = /^([A-Za-z0-9_-]{1,64})\.([A-Za-z0-9_-]{1,63})$/;

/** An S256 challenge: the unpadded base64url SHA-256 of a verifier. */
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

/** A verifier as RFC 7636 allows one: 43 to 128 unreserved characters. */
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

/** What a malformed verifier answers: present, and never a challenge. */
const MALFORMED_VERIFIER = "malformed verifier";

/** The longest display name an app is promised. */
const DISPLAY_NAME_LIMIT = 256;

function shapedAsApp(app: string, domain: string | undefined): boolean {
  const loopback = LOOPBACK_APP.exec(app);
  if (loopback !== null) return Number(loopback[1]) <= 65_535;
  if (domain === undefined || !app.startsWith("https://")) return false;
  const host = app.slice("https://".length);
  if (host === domain) return true;
  return host.endsWith(`.${domain}`) && HOSTNAME_LABEL.test(host.slice(0, -(domain.length + 1)));
}

/**
 * Is this exactly the origin of an app Commons signs people in to?
 *
 * An app is named by its origin alone, written the one way a browser writes it:
 * lowercase, with no path, query, fragment, credentials, or trailing slash. It
 * is the configured domain or a name one label below it, over https; or, for
 * development, `localhost` or `127.0.0.1` at an explicit port, over http.
 * Commons' own origin never qualifies, so no page Commons serves is ever an
 * app's callback.
 */
export function isConnectApp(
  app: unknown,
  domain: string | undefined,
  commonsOrigin: string,
): boolean {
  return (
    typeof app === "string" &&
    shapedAsApp(app, domain) &&
    new URL(app).origin !== new URL(commonsOrigin).origin
  );
}

export function connectAppAccepted({ app }: { app: string }): boolean {
  return isConnectApp(app, configuredConnectAppDomain(), configuredPublicOrigin());
}

/**
 * Does this sign-in request carry a challenge Commons accepts?
 *
 * An app sends the S256 challenge of a verifier its server keeps, with
 * `code_challenge_method=S256`; a missing method would mean `plain`, which is
 * refused. Only the platform's owner portal, at the configured domain itself,
 * may still ask without a challenge.
 */
export function isConnectChallenge(
  app: string,
  challenge: unknown,
  method: unknown,
  domain: string | undefined,
): boolean {
  if (challenge == null)
    return method == null && domain !== undefined && app === `https://${domain}`;
  return typeof challenge === "string" && CHALLENGE.test(challenge) && method === "S256";
}

export function connectChallengeAccepted({
  app,
  challenge,
  method,
}: {
  app: string;
  challenge?: string | null;
  method?: string | null;
}): boolean {
  return isConnectChallenge(app, challenge, method, configuredConnectAppDomain());
}

/**
 * The S256 challenge of a verifier: its hash, nothing when no verifier
 * came, and a value that matches no challenge when the verifier is malformed.
 */
export function connectVerifierChallenge({
  verifier,
}: {
  verifier?: string | null;
}): string | null {
  if (verifier == null) return null;
  if (typeof verifier !== "string" || !VERIFIER.test(verifier)) return MALFORMED_VERIFIER;
  return createHash("sha256").update(verifier).digest("base64url");
}

/** The host an accepted app is shown by, with its port when it names one. */
export function connectAppHost({ app }: { app: string }): string {
  return app.slice(app.indexOf("://") + 3);
}

/** Where an app receives its code: one fixed path, which an app cannot choose. */
export function connectCallback({ app }: { app: string }): string {
  return `${app}/auth/commons/callback`;
}

export function connectCodeExpiry({ at }: { at: Date }): Date {
  return new Date(at.getTime() + CODE_VALIDITY_MS);
}

export function connectCode({
  voucher,
  credential,
}: {
  voucher: string;
  credential: string;
}): string {
  return `${voucher}.${credential}`;
}

/** A code that is not a voucher and credential names an empty voucher, which nothing matches. */
export function connectCodeVoucher({ code }: { code: string }): string {
  return (typeof code === "string" && CODE.exec(code)?.[1]) || "";
}

export function connectCodeCredential({ code }: { code: string }): string {
  return (typeof code === "string" && CODE.exec(code)?.[2]) || "";
}

/**
 * The name an app shows for a person: their profile's display name, or their
 * username when they have no profile or its name is blank. Commons does not
 * bound display names, so the name is cut to the length apps are promised,
 * never inside a character.
 */
export function connectDisplayName({
  username,
  displayName,
}: {
  username: string;
  displayName: unknown;
}): string {
  const name = typeof displayName === "string" ? displayName.trim() : "";
  if (name === "") return username;
  if (name.length <= DISPLAY_NAME_LIMIT) return name;
  const last = name.charCodeAt(DISPLAY_NAME_LIMIT - 1);
  const end = last >= 0xd800 && last <= 0xdbff ? DISPLAY_NAME_LIMIT - 1 : DISPLAY_NAME_LIMIT;
  return name.slice(0, end);
}

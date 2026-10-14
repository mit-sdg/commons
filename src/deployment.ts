import { SLOW_REQUEST_MS } from "./assembly/slow-requests.ts";
import { isPasswordVerifier } from "./concepts/authenticating/password-verifier.ts";

export function configuredPublicOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.NODE_ENV === "production" && env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  return (env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}

/** One DNS label: lowercase letters, digits and inner hyphens, at most 63 characters. */
export const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * The domain whose apps may sign people in with Commons: the domain itself and
 * every name one label below it. Unset, only an app on this machine may.
 */
export function configuredConnectAppDomain(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const domain = env.CONNECT_APP_DOMAIN?.trim().toLowerCase();
  if (domain === undefined || domain === "") return undefined;
  if (domain.length > 253 || !domain.split(".").every((label) => HOSTNAME_LABEL.test(label))) {
    throw new Error(
      "commons: CONNECT_APP_DOMAIN must be a hostname without a scheme, wildcard, port or path.",
    );
  }
  return domain;
}

export function configuredMongodbUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const uri = env.MONGODB_URI === "" ? undefined : env.MONGODB_URI;
  const url = env.MONGODB_URL === "" ? undefined : env.MONGODB_URL;
  if (uri !== undefined && url !== undefined && uri !== url) {
    throw new Error("commons: MONGODB_URI and MONGODB_URL must not conflict.");
  }
  return uri ?? url;
}

/** Rows of one list read at once unless `READ_AHEAD` says otherwise. */
export const READ_AHEAD = 32;

/** A whole number of rows from `READ_AHEAD`, or undefined when it is not one. */
function readAheadRows(source: string): number | undefined {
  const rows = /^\d+$/.test(source) ? Number(source) : Number.NaN;
  return Number.isSafeInteger(rows) ? rows : undefined;
}

/**
 * How many rows of one list are read at once. `0`, `1`, `off`, and any value
 * that is not a whole number read them one after another, so a mistyped value
 * turns read-ahead off rather than stopping the server.
 */
export function configuredReadAhead(env: NodeJS.ProcessEnv = process.env): number {
  const source = env.READ_AHEAD?.trim() ?? "";
  if (source === "") return READ_AHEAD;
  return Math.max(readAheadRows(source) ?? 1, 1);
}

/** The startup warning for a `READ_AHEAD` that is neither a whole number nor `off`. */
export function readAheadWarning(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const source = env.READ_AHEAD?.trim() ?? "";
  if (source === "" || source.toLowerCase() === "off" || readAheadRows(source) !== undefined) {
    return undefined;
  }
  return `commons: READ_AHEAD "${source}" is not a number of rows or off; reading the rows of a list one at a time.`;
}

/** How query answers are reused unless `QUERY_CACHE` says otherwise. */
export const QUERY_CACHE = "since-dispatch";

/**
 * The engine's query cache. Under `since-dispatch` a request reuses only
 * answers read since it arrived, and requests already running keep theirs;
 * `memoize` clears every query cache whenever a request arrives, as before, and
 * so does any other value, so a mistyped value never stops the server.
 */
export function configuredQueryCache(
  env: NodeJS.ProcessEnv = process.env,
): "since-dispatch" | "memoize" {
  const source = env.QUERY_CACHE?.trim() ?? "";
  if (source === "") return QUERY_CACHE;
  return source === "since-dispatch" ? "since-dispatch" : "memoize";
}

/** The startup warning for a `QUERY_CACHE` that is neither `since-dispatch` nor `memoize`. */
export function queryCacheWarning(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const source = env.QUERY_CACHE?.trim() ?? "";
  if (source === "" || source === "since-dispatch" || source === "memoize") return undefined;
  return `commons: QUERY_CACHE "${source}" is not since-dispatch or memoize; clearing every query cache when a request arrives.`;
}

/**
 * Requests that take this many milliseconds or longer are logged. `0`, `off`,
 * and any value that is not a whole number of milliseconds log none; an
 * unrecognised value is reported once through `warn` rather than stopping startup.
 */
export function configuredSlowRequestMs(
  env: NodeJS.ProcessEnv = process.env,
  warn: (line: string) => void = (line) => console.warn(line),
): number | undefined {
  const source = env.SLOW_REQUEST_MS?.trim() ?? "";
  if (source === "") return SLOW_REQUEST_MS;
  if (source.toLowerCase() === "off") return undefined;
  const ms = /^\d+$/.test(source) ? Number(source) : Number.NaN;
  if (!Number.isSafeInteger(ms)) {
    warn(
      `commons: SLOW_REQUEST_MS "${source}" is not a number of milliseconds; slow requests are not logged.`,
    );
    return undefined;
  }
  return ms === 0 ? undefined : ms;
}

export function configuredAdminSetupSecretVerifier(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const verifier = env.ADMIN_SETUP_SECRET_HASH;
  if (verifier === undefined || verifier === "") return undefined;
  if (!isPasswordVerifier(verifier)) {
    throw new Error("commons: ADMIN_SETUP_SECRET_HASH is not a valid setup-secret hash.");
  }
  return verifier;
}

/** The documented floor for a derivation secret: 32 random bytes, hex or base64. */
const SECRET_MINIMUM_CHARACTERS = 32;

function configuredDerivationSecret(env: NodeJS.ProcessEnv, name: string): string {
  const secret = env[name];
  if (secret === undefined || secret === "") {
    throw new Error(`commons: ${name} is required in production.`);
  }
  if (secret.length < SECRET_MINIMUM_CHARACTERS) {
    throw new Error(
      `commons: ${name} must carry at least ${SECRET_MINIMUM_CHARACTERS} characters of random data.`,
    );
  }
  return secret;
}

export function validateDeploymentConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  configuredAdminSetupSecretVerifier(env);
  configuredConnectAppDomain(env);
  const mongodbUrl = configuredMongodbUrl(env);
  if (env.NODE_ENV !== "production") return;
  if (env.PUBLIC_ORIGIN === undefined) {
    throw new Error("commons: PUBLIC_ORIGIN is required in production.");
  }
  const invitationSecret = configuredDerivationSecret(env, "INVITATION_SECRET");
  const voucherSecret = configuredDerivationSecret(env, "VOUCHER_SECRET");
  if (voucherSecret === invitationSecret) {
    throw new Error("commons: VOUCHER_SECRET must differ from INVITATION_SECRET.");
  }
  if (mongodbUrl === undefined) {
    throw new Error("commons: MONGODB_URI or MONGODB_URL is required in production.");
  }
}

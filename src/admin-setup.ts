import type { CommonsApp } from "./assembly/application.ts";
import {
  ADMIN_ROLE,
  FORUM,
  INITIAL_ADMIN_CAPABILITIES,
} from "./compositions/access/capabilities.ts";
import {
  EmailInvalid,
  PasswordInvalidLength,
  UsernameInvalidChars,
  UsernameInvalidLength,
  UsernameTaken,
} from "./concepts/authenticating/errors.ts";
import { passwordMatchesVerifier } from "./concepts/authenticating/password-verifier.ts";

const SETUP_PATH = "/api/setup/register-admin";
const MAX_BODY_BYTES = 16 * 1024;

const response = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });

function bearerSecret(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization === null || !authorization.startsWith("Bearer ")) return undefined;
  const secret = authorization.slice("Bearer ".length);
  return secret === "" || secret.length > 1024 ? undefined : secret;
}

function registrationBody(
  value: unknown,
): { username: string; password: string; displayName: string; email: string } | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const { username, password, displayName, email } = record;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof displayName !== "string" ||
    typeof email !== "string" ||
    displayName.trim() === "" ||
    displayName.length > 200 ||
    email.length > 320
  ) {
    return undefined;
  }
  return { username, password, displayName: displayName.trim(), email };
}

async function parseBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return undefined;
  try {
    return registrationBody(await request.json());
  } catch {
    return undefined;
  }
}

async function registerInitialAdmin(
  application: CommonsApp,
  verifier: string,
  request: Request,
): Promise<Response> {
  const secret = bearerSecret(request);
  if (secret === undefined || !(await passwordMatchesVerifier(secret, verifier))) {
    return response(401, "UNAUTHORIZED");
  }

  const { count } = await application.concepts.Authenticating._getUserCount({});
  if (count !== 0) return response(409, "CONFLICT");

  const body = await parseBody(request);
  if (body === undefined) return response(400, "INVALID_REQUEST");

  try {
    const { user } = await application.concepts.Authenticating.register(body);
    await application.concepts.Profiling.createProfile({
      user,
      displayName: body.displayName,
      email: body.email,
    });
    const { role } = await application.concepts.Roling.ensureRole({
      name: ADMIN_ROLE,
      capabilities: [...INITIAL_ADMIN_CAPABILITIES],
    });
    await application.concepts.Roling.grant({ user, context: FORUM, role });
    return Response.json(
      { user },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (
      error instanceof EmailInvalid ||
      error instanceof PasswordInvalidLength ||
      error instanceof UsernameInvalidChars ||
      error instanceof UsernameInvalidLength
    ) {
      return response(400, "INVALID_REQUEST");
    }
    if (error instanceof UsernameTaken) return response(409, "CONFLICT");
    throw error;
  }
}

export function createAdminSetupHandler(application: CommonsApp, verifier: string | undefined) {
  let queue = Promise.resolve();

  return (request: Request): Promise<Response> | undefined => {
    const url = new URL(request.url);
    if (url.pathname !== SETUP_PATH) return undefined;
    if (request.method !== "POST") return Promise.resolve(response(405, "METHOD_NOT_ALLOWED"));
    if (verifier === undefined) return Promise.resolve(response(404, "NOT_FOUND"));

    const result = queue.then(() => registerInitialAdmin(application, verifier, request));
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result.catch(() => response(500, "INTERNAL_ERROR"));
  };
}

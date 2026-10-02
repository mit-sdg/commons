import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

const PATH = "/api/auth/authenticate";
const ORIGIN = "https://client.mit-sdg.dev";
const CREDENTIALS = { username: "external_user", password: " password123 " };
const DISPLAY_NAME = "External User";
const EMAIL = "external@example.edu";

beforeEach(() => vi.stubEnv("EXTERNAL_AUTH_ALLOWED_DOMAIN", "mit-sdg.dev"));
afterEach(() => vi.unstubAllEnvs());

async function setup(withProfile = true) {
  const database = await testDb();
  const edge = createEdge(mongoImplementations(database));
  const { user } = await edge.application.concepts.Authenticating.register({
    ...CREDENTIALS,
    email: EMAIL,
  });
  if (withProfile) {
    await edge.application.concepts.Profiling.createProfile({ user, displayName: DISPLAY_NAME });
  }
  const identity = {
    user,
    username: CREDENTIALS.username,
    displayName: DISPLAY_NAME,
    email: EMAIL,
  };
  return { database, edge, user, identity };
}

function post(body: unknown, origin: string | null = ORIGIN, cookie?: string, path = PATH) {
  return new Request(`http://edge${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin === null ? {} : { Origin: origin }),
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  });
}

function preflight(origin: string, method = "POST", headers = "content-type", path = PATH) {
  return new Request(`http://edge${path}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": method,
      "Access-Control-Request-Headers": headers,
    },
  });
}

function expectCors(response: Response, origin = ORIGIN) {
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  expect(response.headers.get("Vary")).toMatch(/Origin/i);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(response.headers.get("Set-Cookie")).toBeNull();
}

describe("external credential authentication", () => {
  test("returns account identity and name without creating a Commons session", async () => {
    const { database, edge, identity } = await setup();
    expect(edge.publicPaths.has("/auth/authenticate")).toBe(true);
    expect(edge.sessionPaths.has("/auth/authenticate")).toBe(false);
    for (const origin of [ORIGIN, null]) {
      const response = await edge.fetch(post(CREDENTIALS, origin));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(identity);
      expect(response.headers.get("Set-Cookie")).toBeNull();
      if (origin !== null) expectCors(response);
    }
    expect(await database.collection("sessioning.sessions").countDocuments()).toBe(0);
  });

  test("reads the current name and uses only the authenticated account's fields", async () => {
    const { edge, user, identity } = await setup();
    const other = await edge.application.concepts.Authenticating.register({
      username: "another_user",
      password: "another-password",
      email: "another@example.edu",
    });
    await edge.application.concepts.Profiling.createProfile({
      user: other.user,
      displayName: "Another User",
    });
    await edge.application.concepts.Profiling.setDisplayName({ user, displayName: "Updated Name" });
    const response = await edge.fetch(post(CREDENTIALS));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...identity, displayName: "Updated Name" });
    expectCors(response);
    const selectedUser = await edge.fetch(post({ ...CREDENTIALS, user: other.user }));
    expect(selectedUser.status).toBe(400);
    expect(await selectedUser.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("accounts without a profile authenticate with their username as display name", async () => {
    const { edge, identity } = await setup(false);
    const response = await edge.fetch(post(CREDENTIALS));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ...identity, displayName: CREDENTIALS.username });
    expectCors(response);
  });

  test("unknown users, wrong passwords and altered credentials have the same refusal", async () => {
    const { database, edge } = await setup();
    for (const credentials of [
      { ...CREDENTIALS, username: "unknown_user" },
      { ...CREDENTIALS, password: "wrong-password" },
      { ...CREDENTIALS, password: CREDENTIALS.password.trim() },
      { ...CREDENTIALS, username: CREDENTIALS.username.toUpperCase() },
      { ...CREDENTIALS, username: ` ${CREDENTIALS.username} ` },
    ]) {
      const response = await edge.fetch(post(credentials));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
      expectCors(response);
    }
    expect(await database.collection("sessioning.sessions").countDocuments()).toBe(0);
  });

  test("archived accounts verify credentials before being refused", async () => {
    const { database, edge, user } = await setup();
    await edge.application.concepts.Archiving.trash({ item: user, by: user, at: new Date() });
    const wrong = await edge.fetch(post({ ...CREDENTIALS, password: "wrong-password" }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: "UNAUTHORIZED" });
    expectCors(wrong);
    const correct = await edge.fetch(post(CREDENTIALS));
    expect(correct.status).toBe(403);
    expect(await correct.json()).toEqual({ error: "FORBIDDEN" });
    expectCors(correct);
    expect(await database.collection("sessioning.sessions").countDocuments()).toBe(0);
  });

  test("existing and invalid Commons cookies do not affect authentication or session state", async () => {
    const { database, edge, user, identity } = await setup();
    const { session } = await edge.application.concepts.Sessioning.start({
      user,
      at: new Date(Date.now() - 24 * 60 * 60 * 1_000),
    });
    const sessions = database.collection("sessioning.sessions");
    const before = await sessions.find().toArray();
    for (const cookie of [`__Host-commons-session=${session}`, "__Host-commons-session=invalid"]) {
      const success = await edge.fetch(post(CREDENTIALS, ORIGIN, cookie));
      expect(success.status).toBe(200);
      expect(await success.json()).toEqual(identity);
      expectCors(success);
      const failure = await edge.fetch(
        post({ ...CREDENTIALS, password: "wrong-password" }, ORIGIN, cookie),
      );
      expect(failure.status).toBe(401);
      expectCors(failure);
    }
    expect(await sessions.find().toArray()).toEqual(before);
  });

  test("rejects malformed credentials with CORS before account lookup", async () => {
    const { edge } = await setup();
    for (const body of [
      null,
      [],
      7,
      {},
      { username: CREDENTIALS.username },
      { ...CREDENTIALS, username: { $ne: null } },
      { ...CREDENTIALS, password: 123 },
      { ...CREDENTIALS, password: null },
      { ...CREDENTIALS, username: "x".repeat(33) },
      { ...CREDENTIALS, password: "x".repeat(129) },
      { ...CREDENTIALS, session: "body-token" },
    ]) {
      const response = await edge.fetch(post(body));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
      expectCors(response);
    }
    for (const body of ["{", "x".repeat(1_048_577)]) {
      const response = await edge.fetch(
        new Request(`http://edge${PATH}`, {
          method: "POST",
          headers: { Origin: ORIGIN, "Content-Type": "application/json" },
          body,
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
      expectCors(response);
    }
  });
});

describe("external authentication CORS scope", () => {
  test("uses the configured hostname and captures it when the backend starts", async () => {
    vi.stubEnv("EXTERNAL_AUTH_ALLOWED_DOMAIN", "  CLIENTS.EXAMPLE.EDU  ");
    const { edge } = await setup();
    // Changing the environment after startup requires a new edge to take effect.
    vi.stubEnv("EXTERNAL_AUTH_ALLOWED_DOMAIN", "mit-sdg.dev");
    for (const origin of [
      "https://app.clients.example.edu",
      "http://nested.app.clients.example.edu:8080",
    ]) {
      const response = await edge.fetch(preflight(origin));
      expect(response.status).toBe(204);
      expectCors(response, origin);
      const authenticated = await edge.fetch(post(CREDENTIALS, origin));
      expect(authenticated.status).toBe(200);
      expectCors(authenticated, origin);
    }
    for (const origin of [
      ORIGIN,
      "https://clients.example.edu",
      "https://evilclients.example.edu",
      "https://app.clients.example.edu.evil.example",
    ]) {
      const response = await edge.fetch(preflight(origin));
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    }
  });

  test("unset or empty configuration disables CORS while server authentication still works", async () => {
    for (const domain of [undefined, ""]) {
      vi.stubEnv("EXTERNAL_AUTH_ALLOWED_DOMAIN", domain);
      const { edge, identity } = await setup();
      const preflightResponse = await edge.fetch(preflight(ORIGIN));
      expect(preflightResponse.status).toBe(403);
      expect(preflightResponse.headers.get("Access-Control-Allow-Origin")).toBeNull();
      const browserResponse = await edge.fetch(post(CREDENTIALS));
      expect(browserResponse.headers.get("Access-Control-Allow-Origin")).toBeNull();
      const serverResponse = await edge.fetch(post(CREDENTIALS, null));
      expect(serverResponse.status).toBe(200);
      expect(await serverResponse.json()).toEqual(identity);
      expect(serverResponse.headers.get("Set-Cookie")).toBeNull();
    }
  });

  test("permits subdomains, nested subdomains and explicit ports through native preflight", async () => {
    const { edge } = await setup();
    for (const origin of [
      ORIGIN,
      "https://nested.client.mit-sdg.dev",
      "http://client.mit-sdg.dev:8080",
    ]) {
      const response = await edge.fetch(preflight(origin));
      expect(response.status).toBe(204);
      expectCors(response, origin);
      expect(response.headers.get("Access-Control-Allow-Methods")).toMatch(/POST/);
      expect(response.headers.get("Access-Control-Allow-Headers")).toMatch(/Content-Type/i);
      expect(response.headers.get("Vary")).toMatch(/Access-Control-Request-Method/i);
      expect(response.headers.get("Vary")).toMatch(/Access-Control-Request-Headers/i);
    }
  });

  test("rejects unrelated, lookalike, apex, opaque and malformed origins", async () => {
    const { edge } = await setup();
    for (const origin of [
      "https://unrelated.example",
      "https://mit-sdg.dev",
      "https://evilmit-sdg.dev",
      "https://client.mit-sdg.dev.evil.example",
      "https://client.mit-sdg.dev@evil.example",
      "https://user@client.mit-sdg.dev",
      "https://client.mit-sdg.dev/path",
      "https://client.mit-sdg.dev?query",
      "https://client.mit-sdg.dev#fragment",
      "ftp://client.mit-sdg.dev",
      "null",
    ]) {
      const response = await edge.fetch(preflight(origin));
      expect(response.status).toBe(403);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("Set-Cookie")).toBeNull();
    }
    const response = await edge.fetch(post(CREDENTIALS, "https://unrelated.example"));
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Vary")).toMatch(/Origin/i);
  });

  test("preflight refuses unsupported methods and headers without enabling credentials", async () => {
    const { edge } = await setup();
    for (const request of [
      preflight(ORIGIN, "DELETE"),
      preflight(ORIGIN, "POST", "authorization"),
    ]) {
      const response = await edge.fetch(request);
      expect(response.status).toBe(403);
      expectCors(response);
    }
    const get = await edge.fetch(
      new Request(`http://edge${PATH}`, { headers: { Origin: ORIGIN } }),
    );
    expect(get.status).toBe(400);
    expectCors(get);
  });

  test("CORS access does not extend to login or protected endpoints", async () => {
    const { edge } = await setup();
    const login = await edge.fetch(post(CREDENTIALS, ORIGIN, undefined, "/api/auth/login"));
    expect(login.status).toBe(403);
    expect(login.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(login.headers.get("Set-Cookie")).toBeNull();
    for (const path of ["/api/auth/login", "/api/auth/me", "/auth/authenticate", `${PATH}/`]) {
      const response = await edge.fetch(preflight(ORIGIN, "POST", "content-type", path));
      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(response.status).not.toBe(204);
    }
    const me = await edge.fetch(post({}, ORIGIN, undefined, "/api/auth/me"));
    expect(me.status).toBe(401);
    expect(me.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const sameOriginLogin = await edge.fetch(
      post(CREDENTIALS, "http://127.0.0.1:3000", undefined, "/api/auth/login"),
    );
    expect(sameOriginLogin.status).toBe(200);
    expect(sameOriginLogin.headers.get("Set-Cookie")).toMatch(/SameSite=Strict/);
  });
});

afterAll(stopTestDb);

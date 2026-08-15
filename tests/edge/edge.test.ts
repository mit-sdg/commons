import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/vocabulary.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { derivePasswordVerifier } from "../../src/concepts/authenticating/password-verifier.ts";
import { createEdge } from "../../src/edge.ts";

type Edge = ReturnType<typeof createEdge>;

const post = (edge: Edge, path: string, body: unknown, cookie?: string) =>
  edge.fetch(
    new Request(`http://edge${path.startsWith("/api/") ? path : `/api${path}`}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

const ALICE = {
  username: "alice",
  password: "pw-alice-1",
  displayName: "Alice",
  email: "alice@example.com",
};

async function registerAndLogin(edge: Edge) {
  const registered = await edge.application.concepts.Authenticating.register(ALICE);
  await edge.application.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: ALICE.displayName,
    email: ALICE.email,
  });
  const login = await post(edge, "/auth/login", {
    username: ALICE.username,
    password: ALICE.password,
  });
  const body = (await login.json()) as { user: string };
  const cookie = login.headers.get("Set-Cookie")?.split(";")[0] as string;
  return { login, body, cookie };
}

describe("HTTP route derivation", () => {
  let edge: Edge;
  beforeAll(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
  });

  test("every route requiring session accepts the session cookie", () => {
    expect(edge.sessionPaths.has("/bookmarks/list")).toBe(true);
    expect(edge.sessionPaths.has("/auth/logout")).toBe(true);
    expect(edge.sessionPaths.has("/auth/login")).toBe(false);
    expect(edge.sessionPaths.has("/auth/register")).toBe(false);
    expect(edge.publicPaths.has("/setup/register-admin")).toBe(true);
    for (const path of edge.sessionPaths) expect(edge.servedPaths.has(path)).toBe(true);
  });
});

describe("deployment routes", () => {
  test("reports process liveness and database readiness", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const live = await edge.fetch(new Request("http://edge/health/live"));
    expect(live.status).toBe(200);
    expect(await live.json()).toEqual({ status: "ok" });

    const ready = await edge.fetch(new Request("http://edge/health/ready"));
    expect(ready.status).toBe(200);
    expect(await ready.json()).toEqual({ status: "ok" });
  });

  test("registers exactly one initial administrator through the application endpoint", async () => {
    const previousVerifier = process.env.ADMIN_SETUP_SECRET_HASH;
    const secret = "a-setup-secret-that-is-at-least-32-characters";
    process.env.ADMIN_SETUP_SECRET_HASH = await derivePasswordVerifier(secret);
    try {
      const edge = createEdge(mongoImplementations(await testDb()));
      const request = (setupSecret: string) =>
        post(edge, "/setup/register-admin", { setupSecret, ...ALICE });

      const unauthorized = await request("not-the-secret");
      expect(unauthorized.status).toBe(401);
      expect(await unauthorized.json()).toEqual({ error: "UNAUTHORIZED" });

      const registered = await request(secret);
      expect(registered.status).toBe(200);
      const { user } = (await registered.json()) as { user: string };
      expect(
        await edge.application.concepts.Roling._hasCapability({
          user,
          context: "forum",
          capability: "administer",
        }),
      ).toEqual({ allowed: true });
      expect(await edge.application.concepts.Profiling._getProfile({ user })).toMatchObject([
        { profile: { displayName: ALICE.displayName, email: ALICE.email } },
      ]);

      const initialized = await request(secret);
      expect(initialized.status).toBe(409);
      expect(await initialized.json()).toEqual({ error: "CONFLICT" });
    } finally {
      if (previousVerifier === undefined) delete process.env.ADMIN_SETUP_SECRET_HASH;
      else process.env.ADMIN_SETUP_SECRET_HASH = previousVerifier;
    }
  });

  test("rejects setup when no verifier is configured", async () => {
    const previousVerifier = process.env.ADMIN_SETUP_SECRET_HASH;
    delete process.env.ADMIN_SETUP_SECRET_HASH;
    try {
      const edge = createEdge(mongoImplementations(await testDb()));
      const disabled = await post(edge, "/setup/register-admin", {
        setupSecret: "unused",
        ...ALICE,
      });
      expect(disabled.status).toBe(401);
      expect(await disabled.json()).toEqual({ error: "UNAUTHORIZED" });
    } finally {
      if (previousVerifier === undefined) delete process.env.ADMIN_SETUP_SECRET_HASH;
      else process.env.ADMIN_SETUP_SECRET_HASH = previousVerifier;
    }
  });
});

describe("HTTP session cookies", () => {
  test("login returns user data and sets the session cookie", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { login, body, cookie } = await registerAndLogin(edge);
    expect(login.status).toBe(200);
    expect(body).not.toHaveProperty("session");
    expect(body).not.toHaveProperty("expiresAt");
    const setCookie = login.headers.get("Set-Cookie");
    expect(setCookie).toMatch(
      new RegExp(`^${cookie}; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=`),
    );
  });

  test("the session cookie replaces placeholder body values", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { cookie } = await registerAndLogin(edge);
    for (const placeholder of ["", "cookie"]) {
      const me = await post(edge, "/auth/me", { session: placeholder }, cookie);
      expect(me.status).toBe(200);
      const who = (await me.json()) as { username: string };
      expect(who.username).toBe(ALICE.username);
    }
  });

  test("post mutations reject body tokens and authorize the cookie's user", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { cookie: aliceCookie } = await registerAndLogin(edge);
    const bob = await edge.application.concepts.Authenticating.register({
      username: "bob",
      password: "pw-bob-123",
      email: "bob@example.com",
    });
    await edge.application.concepts.Profiling.createProfile({
      user: bob.user,
      displayName: "Bob",
      email: "bob@example.com",
    });
    const bobLogin = await post(edge, "/auth/login", { username: "bob", password: "pw-bob-123" });
    const bobCookie = bobLogin.headers.get("set-cookie")?.split(";")[0] as string;
    const made = await post(edge, "/threads/create", { content: "owned by Alice" }, aliceCookie);
    const { post: item } = (await made.json()) as { post: string };

    const bodyOnly = await post(edge, "/posts/edit", {
      session: aliceCookie.slice("session=".length),
      post: item,
      content: "body token must not work",
    });
    expect(bodyOnly.status).toBe(401);
    expect(await bodyOnly.json()).toEqual({ error: "UNAUTHORIZED" });

    const conflictingEdit = await post(
      edge,
      "/posts/edit",
      { session: bobCookie.slice("session=".length), post: item, content: "cookie wins" },
      aliceCookie,
    );
    expect(conflictingEdit.status).toBe(200);

    const conflictingDelete = await post(
      edge,
      "/posts/delete",
      { session: aliceCookie.slice("session=".length), post: item },
      bobCookie,
    );
    expect(conflictingDelete.status).toBe(403);
  });

  test("a placeholder without a cookie returns 401 and clears the cookie", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    await registerAndLogin(edge);
    const me = await post(edge, "/auth/me", { session: "" });
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(me.headers.get("Set-Cookie")).toBe(
      "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
    );
  });

  test("logout clears the cookie", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { cookie } = await registerAndLogin(edge);
    const out = await post(edge, "/auth/logout", { session: "" }, cookie);
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ ok: true });
    expect(out.headers.get("Set-Cookie")).toBe(
      "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
    );
  });

  test("login succeeds even when the request includes an expired cookie", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { cookie } = await registerAndLogin(edge);
    await post(edge, "/auth/logout", {}, cookie);
    const again = await post(
      edge,
      "/auth/login",
      { username: ALICE.username, password: ALICE.password },
      cookie,
    );
    expect(again.status).toBe(200);
    expect(await again.json()).not.toHaveProperty("session");
    expect(again.headers.get("Set-Cookie")?.split(";")[0]).not.toBe(cookie);
  });

  test("an expired cookie returns 401 and is cleared", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const { cookie } = await registerAndLogin(edge);
    await post(edge, "/auth/logout", {}, cookie);
    const me = await post(edge, "/auth/me", { session: "" }, cookie);
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(me.headers.get("Set-Cookie")).toBe(
      "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
    );
  });
});

describe("HTTP paths and failures", () => {
  test("the edge serves only the configured /api base path", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const registered = await edge.application.concepts.Authenticating.register(ALICE);
    await edge.application.concepts.Profiling.createProfile({
      user: registered.user,
      displayName: ALICE.displayName,
      email: ALICE.email,
    });
    const viaPrefix = await post(edge, "/api/auth/login", {
      username: ALICE.username,
      password: ALICE.password,
    });
    expect(viaPrefix.status).toBe(200);
    const bare = await edge.fetch(
      new Request("http://edge/auth/me", { method: "POST", body: "{}" }),
    );
    expect(bare.status).toBe(404);
  });

  test("an unknown path returns 404 NOT_FOUND", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const gone = await post(edge, "/api/nowhere/at-all", {});
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "NOT_FOUND" });
  });

  test("an anonymous missing-resource read is rejected before resource lookup", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const gone = await post(edge, "/posts/get", { post: "missing" });
    expect(gone.status).toBe(401);
    expect(await gone.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  test("a scalar JSON body returns 400 INVALID_REQUEST", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const refused = await post(edge, "/auth/login", 7);
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("a malformed JSON body returns 400 INVALID_REQUEST", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const bad = await edge.fetch(
      new Request("http://edge/api/auth/login", { method: "POST", body: "{not json" }),
    );
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe("INVALID_REQUEST");
  });
});

afterAll(stopTestDb);

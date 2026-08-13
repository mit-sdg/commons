import { beforeAll, describe, expect, test } from "vite-plus/test";
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
  await post(edge, "/auth/register", ALICE);
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
  beforeAll(() => {
    edge = createEdge();
  });

  test("every route requiring session accepts the session cookie", () => {
    expect(edge.sessionPaths.has("/bookmarks/list")).toBe(true);
    expect(edge.sessionPaths.has("/auth/logout")).toBe(true);
    expect(edge.sessionPaths.has("/auth/login")).toBe(false);
    expect(edge.sessionPaths.has("/auth/register")).toBe(false);
    for (const path of edge.sessionPaths) expect(edge.servedPaths.has(path)).toBe(true);
  });
});

describe("HTTP session cookies", () => {
  test("login returns user data and sets the session cookie", async () => {
    const edge = createEdge();
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
    const edge = createEdge();
    const { cookie } = await registerAndLogin(edge);
    for (const placeholder of ["", "cookie"]) {
      const me = await post(edge, "/auth/me", { session: placeholder }, cookie);
      expect(me.status).toBe(200);
      const who = (await me.json()) as { username: string };
      expect(who.username).toBe(ALICE.username);
    }
  });

  test("post mutations reject body tokens and authorize the cookie's user", async () => {
    const edge = createEdge();
    const { cookie: aliceCookie } = await registerAndLogin(edge);
    await post(edge, "/auth/register", {
      username: "bob",
      password: "pw-bob-123",
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
    const edge = createEdge();
    await registerAndLogin(edge);
    const me = await post(edge, "/auth/me", { session: "" });
    expect(me.status).toBe(401);
    expect(await me.json()).toEqual({ error: "UNAUTHORIZED" });
    expect(me.headers.get("Set-Cookie")).toBe(
      "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
    );
  });

  test("logout clears the cookie", async () => {
    const edge = createEdge();
    const { cookie } = await registerAndLogin(edge);
    const out = await post(edge, "/auth/logout", { session: "" }, cookie);
    expect(out.status).toBe(200);
    expect(await out.json()).toEqual({ ok: true });
    expect(out.headers.get("Set-Cookie")).toBe(
      "__Host-commons-session=; HttpOnly; SameSite=Strict; Path=/; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
    );
  });

  test("login succeeds even when the request includes an expired cookie", async () => {
    const edge = createEdge();
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
    const edge = createEdge();
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
    const edge = createEdge();
    await post(edge, "/api/auth/register", ALICE);
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
    const edge = createEdge();
    const gone = await post(edge, "/api/nowhere/at-all", {});
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "NOT_FOUND" });
  });

  test("an application's missing-resource refusal uses the public 404", async () => {
    const edge = createEdge();
    const gone = await post(edge, "/posts/get", { post: "missing" });
    expect(gone.status).toBe(404);
    expect(await gone.json()).toEqual({ error: "NOT_FOUND" });
  });

  test("a scalar JSON body returns 400 INVALID_REQUEST", async () => {
    const edge = createEdge();
    const refused = await post(edge, "/auth/login", 7);
    expect(refused.status).toBe(400);
    expect(await refused.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("a malformed JSON body returns 400 INVALID_REQUEST", async () => {
    const edge = createEdge();
    const bad = await edge.fetch(
      new Request("http://edge/api/auth/login", { method: "POST", body: "{not json" }),
    );
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toBe("INVALID_REQUEST");
  });
});

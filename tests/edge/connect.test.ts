import { clearFixtureDb, refreshFixture, refreshEdge } from "../support/fixtures.ts";
import { afterAll, afterEach, describe, expect, test, vi } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";

afterAll(stopTestDb);
afterEach(() => vi.unstubAllEnvs());

const COMMONS = "https://class.mit-sdg.dev";
const PORTAL = "https://mit-sdg.dev";
const TEAM_APP = "https://team-7.mit-sdg.dev";
const LOCAL_APP = "http://localhost:4311";
const SECOND = 1_000;

/** RFC 7636, Appendix B: a verifier and the S256 challenge it hashes to. */
const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
const CHALLENGED = { code_challenge: CHALLENGE, code_challenge_method: "S256" };

type Body = Record<string, unknown>;

/** A sign-in request as an app writes it: every app but the owner portal sends a challenge. */
const asking = (app: string): Body => (app === PORTAL ? { app } : { app, ...CHALLENGED });

async function buildFixture(domain: string) {
  vi.stubEnv("PUBLIC_ORIGIN", COMMONS);
  if (domain !== "") vi.stubEnv("CONNECT_APP_DOMAIN", domain);
  const db = await testDb();
  // Keep the HTTP package's real-clock cookie validation independent of the test clock.
  const startedAt = new Date(Date.now() + 60_000);
  let now = startedAt;
  const instances = mongoImplementations(db, () => now);
  const edge = createEdge(instances, COMMONS, () => now);
  const { Authenticating, Profiling } = edge.application.concepts;

  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    edge.fetch(
      new Request(`${COMMONS}/api${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  async function person(username: string, displayName?: string) {
    const { user } = await Authenticating.register({
      username,
      password: "password123",
      email: `${username}@example.edu`,
    });
    if (displayName !== undefined) await Profiling.createProfile({ user, displayName });
    const login = await post("/auth/login", { username, password: "password123" });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    const call = (path: string, body: Body = {}, origin: string | null = COMMONS) =>
      post(path, body, { Cookie: cookie, ...(origin === null ? {} : { Origin: origin }) });
    return { user, username, email: `${username}@example.edu`, call };
  }

  /** Approve an app as this person, the way the consent page does, and take the code. */
  async function approve(
    as: { call: (path: string, body: Body) => Promise<Response> },
    app: string,
    request: Body = asking(app),
  ) {
    const response = await as.call("/connect/approve", request);
    expect(response.status).toBe(200);
    return (await response.json()) as { code: string; callback: string };
  }

  /** Redeem a code the way an app's server does: no cookie, no Origin. */
  const redeem = (body: unknown, headers: Record<string, string> = {}) =>
    post("/connect/redeem", body, headers);

  return {
    db,
    resetEdge: () => refreshEdge(edge, instances, COMMONS, () => now),
    edge,
    resetClock: () => {
      now = startedAt;
    },
    person,
    approve,
    redeem,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

const worlds = new Map<string, Awaited<ReturnType<typeof buildFixture>>>();
async function fixture({ domain = "mit-sdg.dev" }: { domain?: string } = {}) {
  vi.stubEnv("PUBLIC_ORIGIN", COMMONS);
  if (domain !== "") vi.stubEnv("CONNECT_APP_DOMAIN", domain);
  let world = worlds.get(domain);
  if (world === undefined) {
    world = await buildFixture(domain);
    worlds.set(domain, world);
  } else {
    await world.edge.application.whenIdle();
    await clearFixtureDb(world.db);
    world.resetClock();
    await refreshFixture(world.edge.application);
    world.resetEdge();
  }
  return world;
}

async function expectRefused(response: Response) {
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "CONNECT_CODE_INVALID" });
  expect(response.headers.get("Cache-Control")).toBe("no-store");
}

describe("signing in with Commons", () => {
  test("only redemption answers without a session", async () => {
    const f = await fixture();
    expect(f.edge.publicPaths.has("/connect/redeem")).toBe(true);
    expect(f.edge.sessionPaths.has("/connect/redeem")).toBe(false);
    for (const path of ["/connect/describe", "/connect/approve", "/connect/list"]) {
      expect(f.edge.sessionPaths.has(path), path).toBe(true);
      const response = await f.edge.fetch(
        new Request(`${COMMONS}/api${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: COMMONS },
          body: JSON.stringify({ app: PORTAL }),
        }),
      );
      expect(response.status, path).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
    }
  });

  test("the consent page learns the app's host, its callback, and whether it was approved", async () => {
    const f = await fixture();
    const ines = await f.person("ines", "Ines Duarte");
    for (const [app, host] of [
      [PORTAL, "mit-sdg.dev"],
      [TEAM_APP, "team-7.mit-sdg.dev"],
      [LOCAL_APP, "localhost:4311"],
      ["http://127.0.0.1:8080", "127.0.0.1:8080"],
    ] as const) {
      const before = await ines.call("/connect/describe", asking(app));
      expect(before.status).toBe(200);
      expect(await before.json()).toEqual({
        app,
        host,
        callback: `${app}/auth/commons/callback`,
        approved: false,
      });
      await f.approve(ines, app);
      const after = await ines.call("/connect/describe", asking(app));
      expect(await after.json()).toMatchObject({ app, approved: true });
    }
  });

  test("an origin that is not an app is refused and nothing is remembered", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    for (const app of [
      COMMONS,
      "https://a.team-7.mit-sdg.dev",
      "https://evil.example",
      "https://mit-sdg.dev.evil.example",
      "http://mit-sdg.dev",
      "https://Team-7.mit-sdg.dev",
      "https://team-7.mit-sdg.dev/",
      "https://team-7.mit-sdg.dev/auth/commons/callback",
      "https://team-7.mit-sdg.dev:8443",
      "https://user@team-7.mit-sdg.dev",
      "http://localhost",
      "http://localhost:0",
      "http://localhost:65536",
      "",
    ]) {
      for (const path of ["/connect/describe", "/connect/approve"]) {
        const response = await ines.call(path, { app });
        expect(response.status, `${path} ${app}`).toBe(400);
        expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
      }
    }
    expect(await f.db.collection("connecting.connections").countDocuments()).toBe(0);
    expect(await f.db.collection("connectVouching.vouchers").countDocuments()).toBe(0);
  });

  test("describing and approving take an app and an optional challenge, as text; withdrawing takes one field", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    for (const body of [
      {},
      { app: 5 },
      { app: null },
      { app: [PORTAL] },
      { app: PORTAL, user: "x" },
      { app: TEAM_APP, code_challenge: 5, code_challenge_method: "S256" },
      { app: TEAM_APP, code_challenge: CHALLENGE, code_challenge_method: ["S256"] },
      { app: TEAM_APP, ...CHALLENGED, code_verifier: VERIFIER },
    ]) {
      for (const path of ["/connect/describe", "/connect/approve"]) {
        const response = await ines.call(path, body);
        expect(response.status, `${path} ${JSON.stringify(body)}`).toBe(400);
        expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
      }
    }
    for (const body of [{}, { connection: 5 }, { connection: "c", app: PORTAL }]) {
      const response = await ines.call("/connect/withdraw", body);
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
    expect(await f.db.collection("connecting.connections").countDocuments()).toBe(0);
  });

  test("without CONNECT_APP_DOMAIN only an app on this machine is accepted", async () => {
    const f = await fixture({ domain: "" });
    const ines = await f.person("ines");
    expect((await ines.call("/connect/describe", { app: PORTAL })).status).toBe(400);
    expect((await ines.call("/connect/describe", asking(LOCAL_APP))).status).toBe(200);
    // With no configured domain there is no owner portal to let through without a challenge.
    expect((await ines.call("/connect/describe", { app: LOCAL_APP })).status).toBe(400);
  });

  test("a page on another origin cannot approve an app on somebody's behalf", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    for (const origin of [TEAM_APP, PORTAL, "null"]) {
      const response = await ines.call("/connect/approve", asking(TEAM_APP), origin);
      expect(response.status, origin).toBe(403);
      expect(await response.json()).toEqual({ error: "FORBIDDEN" });
    }
    expect(await f.db.collection("connecting.connections").countDocuments()).toBe(0);
    expect(await f.db.collection("connectVouching.vouchers").countDocuments()).toBe(0);
  });

  test("an app other than the owner portal must send an S256 challenge, and nothing is remembered without one", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const malformed: Body[] = [
      { code_challenge: CHALLENGE },
      { code_challenge: CHALLENGE, code_challenge_method: "plain" },
      { code_challenge: CHALLENGE, code_challenge_method: "s256" },
      { code_challenge_method: "S256" },
      { code_challenge: CHALLENGE.slice(1), code_challenge_method: "S256" },
      { code_challenge: `${CHALLENGE}=`, code_challenge_method: "S256" },
      { code_challenge: CHALLENGE.replace("-", "+"), code_challenge_method: "S256" },
      { code_challenge: "a".repeat(64), code_challenge_method: "S256" },
      { code_challenge: "", code_challenge_method: "S256" },
    ];
    for (const [app, requests] of [
      [TEAM_APP, [{}, ...malformed]],
      [LOCAL_APP, [{}, ...malformed]],
      [PORTAL, malformed],
    ] as const) {
      for (const request of requests) {
        for (const path of ["/connect/describe", "/connect/approve"]) {
          const response = await ines.call(path, { app, ...request });
          expect(response.status, `${path} ${app} ${JSON.stringify(request)}`).toBe(400);
          expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
        }
      }
    }
    expect(await f.db.collection("connecting.connections").countDocuments()).toBe(0);
    expect(await f.db.collection("connectVouching.vouchers").countDocuments()).toBe(0);
  });

  test("a code issued with a challenge redeems only with its verifier", async () => {
    const f = await fixture();
    const ines = await f.person("ines", "Ines Duarte");
    for (const app of [TEAM_APP, LOCAL_APP, PORTAL]) {
      const { code } = await f.approve(ines, app, { app, ...CHALLENGED });
      const redeemed = await f.redeem({ code, app, code_verifier: VERIFIER });
      expect(redeemed.status, app).toBe(200);
      expect(await redeemed.json()).toMatchObject({ user: ines.user, displayName: "Ines Duarte" });
      await expectRefused(await f.redeem({ code, app, code_verifier: VERIFIER }));
    }
  });

  test("a missing, wrong, or malformed verifier is refused and spends the code", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    for (const verifier of [
      undefined,
      null,
      "a".repeat(43),
      CHALLENGE,
      VERIFIER.slice(1),
      `${VERIFIER}!`,
      "",
      "x".repeat(129),
    ]) {
      const { code } = await f.approve(ines, TEAM_APP);
      const body =
        verifier === undefined
          ? { code, app: TEAM_APP }
          : { code, app: TEAM_APP, code_verifier: verifier };
      await expectRefused(await f.redeem(body));
      await expectRefused(await f.redeem({ code, app: TEAM_APP, code_verifier: VERIFIER }));
    }
  });

  test("a verifier sent for a code issued without a challenge is refused and spends the code", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    for (const verifier of [VERIFIER, "malformed"]) {
      const { code } = await f.approve(ines, PORTAL);
      await expectRefused(await f.redeem({ code, app: PORTAL, code_verifier: verifier }));
      await expectRefused(await f.redeem({ code, app: PORTAL }));
    }
  });

  test("retained records hold neither a verifier nor a voucher's credential field", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, TEAM_APP);
    expect((await f.redeem({ code, app: TEAM_APP, code_verifier: VERIFIER })).status).toBe(200);
    const occurrences = inspectAssembly(f.edge.application).occurrences;
    expect(JSON.stringify(occurrences)).not.toContain(VERIFIER);
    const issued = occurrences.find(
      (entry) => entry.concept === "ConnectVouching" && entry.action === "issue",
    );
    expect(issued?.output).toMatchObject({ credential: "[redacted]" });
  });

  test("an app's server redeems a code once for the person's identity", async () => {
    const f = await fixture();
    const ines = await f.person("ines", "Ines Duarte");
    const { code, callback } = await f.approve(ines, PORTAL);
    expect(callback).toBe(`${PORTAL}/auth/commons/callback`);
    expect(code).toMatch(/^[A-Za-z0-9._-]{1,128}$/);

    const redeemed = await f.redeem({ code, app: PORTAL });
    expect(redeemed.status).toBe(200);
    expect(redeemed.headers.get("Content-Type")).toMatch(/^application\/json/);
    expect(redeemed.headers.get("Cache-Control")).toBe("no-store");
    expect(redeemed.headers.get("Set-Cookie")).toBeNull();
    expect(await redeemed.json()).toEqual({
      user: ines.user,
      username: "ines",
      displayName: "Ines Duarte",
      email: "ines@example.edu",
    });

    await expectRefused(await f.redeem({ code, app: PORTAL }));
    // Redeeming creates no Commons session for anybody.
    expect(await f.db.collection("sessioning.sessions").countDocuments()).toBe(1);
  });

  test("a person without a profile name is named by their username", async () => {
    const f = await fixture();
    const noProfile = await f.person("noprofile");
    const blank = await f.person("blank", "   ");
    for (const person of [noProfile, blank]) {
      const { code } = await f.approve(person, PORTAL);
      const redeemed = await f.redeem({ code, app: PORTAL });
      expect(await redeemed.json()).toMatchObject({ displayName: person.username });
    }
  });

  test("a code lapses sixty seconds after approval", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const inTime = await f.approve(ines, PORTAL);
    f.advance(59 * SECOND);
    expect((await f.redeem({ code: inTime.code, app: PORTAL })).status).toBe(200);

    const late = await f.approve(ines, PORTAL);
    f.advance(60 * SECOND);
    await expectRefused(await f.redeem({ code: late.code, app: PORTAL }));
  });

  test("a code is spent when presented by another app, and never redeems for it", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, PORTAL);
    await expectRefused(await f.redeem({ code, app: TEAM_APP }));
    await expectRefused(await f.redeem({ code, app: PORTAL }));
  });

  test("withdrawing an approval voids its unredeemed code and asks again next time", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, PORTAL);
    const listed = (await (await ines.call("/connect/list")).json()) as {
      connections: { connection: string }[];
    };
    const [{ connection }] = listed.connections as [{ connection: string }];
    expect((await ines.call("/connect/withdraw", { connection })).status).toBe(200);

    await expectRefused(await f.redeem({ code, app: PORTAL }));
    expect(await (await ines.call("/connect/describe", { app: PORTAL })).json()).toMatchObject({
      approved: false,
    });
  });

  test("an archived account is not signed in to an app", async () => {
    const f = await fixture();
    const admin = await f.person("admin");
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, PORTAL);
    await f.edge.application.concepts.Archiving.trash({
      item: ines.user,
      by: admin.user,
      at: new Date(),
    });
    await expectRefused(await f.redeem({ code, app: PORTAL }));
  });

  test("a new code for an approval retires its older code; two apps' codes stand together", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const older = await f.approve(ines, PORTAL);
    const newer = await f.approve(ines, PORTAL);
    await expectRefused(await f.redeem({ code: older.code, app: PORTAL }));
    expect((await f.redeem({ code: newer.code, app: PORTAL })).status).toBe(200);

    const portal = await f.approve(ines, PORTAL);
    const team = await f.approve(ines, TEAM_APP);
    expect(
      (await f.redeem({ code: team.code, app: TEAM_APP, code_verifier: VERIFIER })).status,
    ).toBe(200);
    expect((await f.redeem({ code: portal.code, app: PORTAL })).status).toBe(200);

    // Another person's code for the same app is theirs alone.
    const paul = await f.person("paul");
    const ines2 = await f.approve(ines, PORTAL);
    const pauls = await f.approve(paul, PORTAL);
    expect(await (await f.redeem({ code: pauls.code, app: PORTAL })).json()).toMatchObject({
      user: paul.user,
    });
    expect(await (await f.redeem({ code: ines2.code, app: PORTAL })).json()).toMatchObject({
      user: ines.user,
    });
  });

  test("malformed codes are refused like any other; malformed requests are invalid", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, PORTAL);
    const [voucher, credential] = code.split(".") as [string, string];
    for (const malformed of [
      "",
      ".",
      voucher,
      `${voucher}.`,
      `.${credential}`,
      `${voucher}.R-guessed`,
      `${voucher}.${credential}.`,
      `${crypto.randomUUID()}.${credential}`,
      ` ${code}`,
      "x".repeat(10_000),
    ]) {
      await expectRefused(await f.redeem({ code: malformed, app: PORTAL }));
    }
    expect((await f.redeem({ code, app: PORTAL })).status).toBe(200);

    for (const body of [
      { code },
      { app: PORTAL },
      { code, app: PORTAL, user: ines.user },
      { code: 1, app: PORTAL },
      { code, app: null },
      [code, PORTAL],
      "not json",
    ]) {
      const response = await f.redeem(body);
      expect(response.status, JSON.stringify(body)).toBe(400);
      expect(await response.json()).toEqual({ error: "INVALID_REQUEST" });
      expect(response.headers.get("Cache-Control")).toMatch(/no-store/);
    }
    const plainText = await f.redeem(JSON.stringify({ code, app: PORTAL }), {
      "Content-Type": "text/plain",
    });
    expect(plainText.status).toBe(400);
    expect(await plainText.json()).toEqual({ error: "INVALID_REQUEST" });
  });

  test("redemption answers no browser page: there are no CORS headers, even for an app", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const { code } = await f.approve(ines, PORTAL);
    const redeemed = await f.redeem({ code, app: PORTAL }, { Origin: PORTAL });
    expect(redeemed.status).toBe(200);
    expect(redeemed.headers.get("Access-Control-Allow-Origin")).toBeNull();

    const preflight = await f.edge.fetch(
      new Request(`${COMMONS}/api/connect/redeem`, {
        method: "OPTIONS",
        headers: {
          Origin: PORTAL,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      }),
    );
    expect(preflight.ok).toBe(false);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toBeNull();
  });

  test("a person sees their own connections, newest first, and only they can withdraw one", async () => {
    const f = await fixture();
    const ines = await f.person("ines");
    const paul = await f.person("paul");
    await f.approve(ines, PORTAL);
    f.advance(SECOND);
    await f.approve(ines, TEAM_APP);
    f.advance(SECOND);
    // Approving again neither moves nor duplicates the connection.
    await f.approve(ines, PORTAL);
    await f.approve(paul, LOCAL_APP);

    const listed = (await (await ines.call("/connect/list")).json()) as {
      connections: { connection: string; app: string; approvedAt: string }[];
    };
    expect(listed.connections.map(({ app }) => app)).toEqual([TEAM_APP, PORTAL]);
    expect(
      new Date(listed.connections[0]!.approvedAt).getTime() -
        new Date(listed.connections[1]!.approvedAt).getTime(),
    ).toBe(SECOND);

    const portal = listed.connections[1]!.connection;
    const stranger = await paul.call("/connect/withdraw", { connection: portal });
    expect(stranger.status).toBe(404);
    expect(await stranger.json()).toEqual({ error: "NOT_FOUND" });

    const withdrawn = await ines.call("/connect/withdraw", { connection: portal });
    expect(withdrawn.status).toBe(200);
    expect(await withdrawn.json()).toEqual({ connection: portal });
    expect((await ines.call("/connect/withdraw", { connection: portal })).status).toBe(404);
    expect(
      (
        (await (await ines.call("/connect/list")).json()) as { connections: { app: string }[] }
      ).connections.map(({ app }) => app),
    ).toEqual([TEAM_APP]);
    expect(
      (
        (await (await paul.call("/connect/list")).json()) as { connections: { app: string }[] }
      ).connections.map(({ app }) => app),
    ).toEqual([LOCAL_APP]);
  });
});

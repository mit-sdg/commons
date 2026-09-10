import { afterAll, afterEach, expect, test, vi } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);
afterEach(() => vi.restoreAllMocks());
const HOUR = 3_600_000;

async function fixture() {
  const db = await testDb();
  // Keep the HTTP package's real-clock cookie validation independent of the test clock.
  const startedAt = new Date(Date.now() + 60_000);
  let now = startedAt;
  const instances = mongoImplementations(db, () => now);
  const realRefresh = instances.Sessioning.refresh.bind(instances.Sessioning);
  const refresh = vi.spyOn(instances.Sessioning, "refresh");
  const edge = createEdge(instances, "https://commons.test", () => now);
  const { user } = await edge.application.concepts.Authenticating.register({
    username: "maya",
    password: "password123",
    email: "maya@example.test",
  });
  await edge.application.concepts.Profiling.createProfile({ user, displayName: "Maya" });
  const request = (
    path: string,
    body: unknown = {},
    cookie?: string,
    headers: Record<string, string> = {},
  ) =>
    edge.fetch(
      new Request(`https://commons.test/api${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  const login = await request("/auth/login", { username: "maya", password: "password123" });
  expect(login.status).toBe(200);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  const session = cookie!.slice(cookie!.indexOf("=") + 1);
  const records = db.collection<{ _id: string; expiresAt: Date; absoluteExpiresAt?: Date }>(
    "sessioning.sessions",
  );
  return {
    db,
    edge,
    instances,
    refresh,
    realRefresh,
    user,
    login,
    cookie,
    session,
    records,
    startedAt,
    atHour: (hour: number) => {
      now = new Date(startedAt.getTime() + hour * HOUR);
    },
    request: (path: string, body: unknown = {}, headers: Record<string, string> = {}) =>
      request(path, body, cookie, headers),
  };
}

test("login fixes cookie expiry at the cap; successful reads slide only the server idle deadline", async () => {
  const f = await fixture();
  const initial = (await f.records.findOne({ _id: f.session }))!;
  expect(initial.expiresAt.getTime() - f.startedAt.getTime()).toBe(72 * HOUR);
  expect(f.login.headers.get("set-cookie")).toContain(
    `Expires=${initial.absoluteExpiresAt!.toUTCString()}`,
  );
  expect(await f.login.json()).toEqual({ user: f.user });
  expect(f.refresh).not.toHaveBeenCalled();
  f.atHour(71);
  const read = await f.request("/auth/me");
  expect(read.status).toBe(200);
  expect(read.headers.get("set-cookie")).toBeNull();
  expect(read.headers.get("cache-control")).toBe("private, no-store");
  const renewed = (await f.records.findOne({ _id: f.session }))!;
  expect(renewed.expiresAt.getTime()).toBe(f.startedAt.getTime() + 143 * HOUR);
  expect(renewed.absoluteExpiresAt).toEqual(initial.absoluteExpiresAt);
  f.atHour(143);
  const expired = await f.request("/auth/me");
  expect(expired.status).toBe(401);
  expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(f.refresh).toHaveBeenCalledTimes(1);
});

test("public, rejected, and direct application calls do not renew", async () => {
  const f = await fixture();
  f.atHour(24);
  expect(
    (await f.request("/auth/login", { username: "maya", password: "password123" })).status,
  ).toBe(200);
  expect((await f.request("/profiles/setDisplayName")).status).toBe(400);
  expect((await f.request("/auth/me", {}, { Origin: "https://untrusted.test" })).status).toBe(403);
  expect((await f.request("/no-such-route")).status).toBe(404);
  expect((await f.edge.gateway.invoke("/auth/me", { session: f.session })).ok).toBe(true);
  const outsider = await f.edge.application.concepts.Authenticating.register({
    username: "outsider",
    password: "password123",
    email: "outsider@example.test",
  });
  const other = await f.edge.application.concepts.Sessioning.start({ user: outsider.user });
  expect(
    (await f.request("/users/list", {}, { Cookie: `__Host-commons-session=${other.session}` }))
      .status,
  ).toBe(403);
  await f.db.collection<{ _id: string }>("profiling.profiles").deleteOne({ _id: f.user });
  expect(
    (await f.request("/profiles/setDisplayName", { displayName: "Missing profile" })).status,
  ).toBe(404);
  expect(f.refresh).not.toHaveBeenCalled();
  expect((await f.records.findOne({ _id: f.session }))?.expiresAt.getTime()).toBe(
    f.startedAt.getTime() + 72 * HOUR,
  );
});

test.each(["/auth/logout", "/auth/changePassword"])(
  "%s revokes and clears without renewal",
  async (path) => {
    const f = await fixture();
    const response = await f.request(
      path,
      path.endsWith("changePassword")
        ? { oldPassword: "password123", newPassword: "a-new-password" }
        : {},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(f.refresh).not.toHaveBeenCalled();
    expect(await f.records.findOne({ _id: f.session })).toBeNull();
  },
);

test("a failed renewal preserves an already committed mutation and logs no credential", async () => {
  const f = await fixture();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  f.refresh.mockRejectedValue(new Error(`private database detail ${f.session}`));
  f.atHour(24);
  const response = await f.request("/profiles/setDisplayName", { displayName: "Updated" });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ user: f.user });
  expect(await f.instances.Profiling._getProfileFields({ user: f.user })).toMatchObject([
    { displayName: "Updated" },
  ]);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(log).toHaveBeenCalledWith("session: could not refresh after successful use.");
  expect(JSON.stringify(log.mock.calls)).not.toContain(f.session);
  expect((await f.records.findOne({ _id: f.session }))?.expiresAt.getTime()).toBe(
    f.startedAt.getTime() + 72 * HOUR,
  );
});

test("a request completing at idle expiry keeps its result without reviving the session", async () => {
  const f = await fixture();
  f.refresh.mockImplementation(async (input) => {
    f.atHour(72);
    return f.realRefresh(input);
  });
  f.atHour(71);
  expect((await f.request("/auth/me")).status).toBe(200);
  expect((await f.records.findOne({ _id: f.session }))?.expiresAt.getTime()).toBe(
    f.startedAt.getTime() + 72 * HOUR,
  );
  expect((await f.request("/auth/me")).status).toBe(401);
});

test("legacy cookies retain their original fixed deadline", async () => {
  const f = await fixture();
  await f.records.updateOne(
    { _id: f.session },
    {
      $unset: { absoluteExpiresAt: "" },
      $set: { expiresAt: new Date(f.startedAt.getTime() + 24 * HOUR) },
    },
  );
  f.atHour(23);
  const read = await f.request("/auth/me");
  expect(read.status).toBe(200);
  expect(read.headers.get("set-cookie")).toBeNull();
  f.atHour(24);
  expect((await f.request("/auth/me")).status).toBe(401);
});

test("activity immediately before the absolute cap cannot extend it", async () => {
  const f = await fixture();
  const cap = (await f.records.findOne({ _id: f.session }))!.absoluteExpiresAt!;
  // Represent a session kept active through the semester; concept tests exercise each renewal.
  await f.records.updateOne({ _id: f.session }, { $set: { expiresAt: cap } });
  const capHour = (cap.getTime() - f.startedAt.getTime()) / HOUR;
  f.atHour(capHour - 1);
  expect((await f.request("/auth/me")).status).toBe(200);
  expect((await f.records.findOne({ _id: f.session }))?.expiresAt).toEqual(cap);
  f.atHour(capHour);
  const expired = await f.request("/auth/me");
  expect(expired.status).toBe(401);
  expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
});

test("revocation between response creation and renewal cannot restore a cookie or session", async () => {
  const f = await fixture();
  f.refresh.mockImplementation(async (input) => {
    await f.instances.Sessioning.endAllForUser({ user: f.user });
    return f.realRefresh(input);
  });
  const response = await f.request("/auth/me");
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(await f.records.findOne({ _id: f.session })).toBeNull();
  expect((await f.request("/auth/me")).status).toBe(401);
});

test("an archived account is rejected even when session cleanup did not run", async () => {
  const f = await fixture();
  // Reproduce the partial failure after archive persistence but before session deletion.
  await f.edge.application.concepts.Archiving.trash({ item: f.user, by: f.user, at: f.startedAt });
  f.atHour(24);
  // This route relies only on the HTTP gate, not the shared activeUser view.
  expect((await f.request("/auth/resolve", { username: "maya" })).status).toBe(401);
  const response = await f.request("/auth/me");
  expect(response.status).toBe(401);
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(f.refresh).not.toHaveBeenCalled();
  expect(await f.records.findOne({ _id: f.session })).not.toBeNull();
  expect(
    await f.edge.gateway.invoke("/profiles/setDisplayName", {
      session: f.session,
      displayName: "Rejected",
    }),
  ).toMatchObject({ ok: false, error: { kind: "domain", value: "UNAUTHORIZED" } });
});

import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

type PublicResponse = {
  status: number;
  body: Record<string, unknown>;
  cookie?: string;
};

const post = async (
  edge: ReturnType<typeof createEdge>,
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
): Promise<PublicResponse> => {
  const response = await edge.fetch(
    new Request(`http://commons.test/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
};

/** Register the first account, which the bootstrap reaction makes administrator. */
const registerAdmin = async (edge: ReturnType<typeof createEdge>) => {
  const app = edge.application;
  const made = await app.concepts.Authenticating.register({
    username: "mara",
    password: "password123",
    email: "mara@example.edu",
  });
  await app.concepts.Profiling.createProfile({ user: made.user, displayName: "Mara" });
  const login = await post(edge, "/auth/login", { username: "mara", password: "password123" });
  return { user: made.user, cookie: login.cookie as string };
};

const registerPerson = async (
  edge: ReturnType<typeof createEdge>,
  username: string,
  email: string,
) => {
  const app = edge.application;
  const made = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email,
  });
  await app.concepts.Profiling.createProfile({ user: made.user, displayName: username });
  const login = await post(edge, "/auth/login", { username, password: "password123" });
  return { user: made.user, cookie: login.cookie as string };
};

const roleOf = async (edge: ReturnType<typeof createEdge>, user: string, cookie: string) =>
  (await post(edge, "/roles/forUser", { user, context: "commons" }, cookie)).body;

describe("naming the subject of a role", () => {
  test("an exact email address names the account that holds it, whatever its spelling", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const helper = await registerPerson(edge, "hana", "Hana@Example.edu");

    const defined = await post(
      edge,
      "/roles/define",
      { name: "helper", capabilities: ["moderate"] },
      admin.cookie,
    );
    expect(defined.status).toBe(200);

    // Authenticating normalizes an address, so surrounding space and letter case
    // do not change who is named.
    const assigned = await post(
      edge,
      "/roles/assign",
      { user: "  HANA@example.EDU ", context: "commons", role: "helper" },
      admin.cookie,
    );
    expect(assigned.status).toBe(200);
    expect(assigned.body.assignment).toEqual(expect.any(String));

    expect(await roleOf(edge, helper.user, admin.cookie)).toEqual({
      role: defined.body.role,
      name: "helper",
      capabilities: ["moderate"],
    });

    const revoked = await post(
      edge,
      "/roles/revoke",
      { user: "hana@example.edu", context: "commons" },
      admin.cookie,
    );
    expect(revoked.status).toBe(200);
    expect(await roleOf(edge, helper.user, admin.cookie)).toEqual({
      role: null,
      name: null,
      capabilities: [],
    });
  });

  test("an exact username still names the same account", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const helper = await registerPerson(edge, "ivo", "ivo@example.edu");

    await post(edge, "/roles/define", { name: "helper", capabilities: ["moderate"] }, admin.cookie);

    const assigned = await post(
      edge,
      "/roles/assign",
      { user: "ivo", context: "commons", role: "helper" },
      admin.cookie,
    );
    expect(assigned.status).toBe(200);
    expect(await roleOf(edge, helper.user, admin.cookie)).toEqual(
      expect.objectContaining({ name: "helper", capabilities: ["moderate"] }),
    );

    expect(
      (await post(edge, "/roles/revoke", { user: "ivo", context: "commons" }, admin.cookie)).status,
    ).toBe(200);
    expect(await roleOf(edge, helper.user, admin.cookie)).toEqual({
      role: null,
      name: null,
      capabilities: [],
    });
  });

  test("an address no account holds is refused, and every other subject stays opaque", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    await post(edge, "/roles/define", { name: "helper", capabilities: ["moderate"] }, admin.cookie);

    // Typing an address nobody holds is a mistake in the name, not an
    // instruction to give a role to a string. The refusal lands before Roling
    // is asked for anything.
    for (const path of ["/roles/assign", "/roles/revoke"]) {
      const refused = await post(
        edge,
        path,
        { user: "  Nobody@Example.edu ", context: "commons", role: "helper" },
        admin.cookie,
      );
      expect(refused.status).toBe(404);
      expect(refused.body).toEqual({ error: "NOT_FOUND" });
    }
    expect(
      await edge.application.concepts.Roling._getRole({
        user: "nobody@example.edu",
        context: "commons",
      }),
    ).toEqual([]);

    // Every subject shape that is not address-shaped keeps today's opaque
    // pass-through: an unknown reference is stored as a user identity.
    const opaque = await post(
      edge,
      "/roles/assign",
      { user: "not-an-account", context: "commons", role: "helper" },
      admin.cookie,
    );
    expect(opaque.status).toBe(200);
    expect(await roleOf(edge, "not-an-account", admin.cookie)).toEqual(
      expect.objectContaining({ name: "helper" }),
    );
  });

  test("a caller who does not administer is refused whatever address they type", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const outsider = await registerPerson(edge, "jae", "jae@example.edu");
    await post(edge, "/roles/define", { name: "helper", capabilities: ["moderate"] }, admin.cookie);

    // The caller is resolved and refused before the subject is interpreted at
    // all, so a held address and an unheld one answer alike.
    for (const subject of ["mara@example.edu", "nobody@example.edu", "mara"]) {
      const assigned = await post(
        edge,
        "/roles/assign",
        { user: subject, context: "commons", role: "helper" },
        outsider.cookie,
      );
      expect(assigned.status).toBe(403);
      expect(assigned.body).toEqual({ error: "FORBIDDEN" });

      const revoked = await post(
        edge,
        "/roles/revoke",
        { user: subject, context: "commons" },
        outsider.cookie,
      );
      expect(revoked.status).toBe(403);
      expect(revoked.body).toEqual({ error: "FORBIDDEN" });
    }

    // Nothing the outsider typed changed what anybody holds.
    expect(await roleOf(edge, admin.user, admin.cookie)).toEqual(
      expect.objectContaining({ name: "administrator" }),
    );
    expect(await roleOf(edge, outsider.user, admin.cookie)).toEqual({
      role: null,
      name: null,
      capabilities: [],
    });
  });

  test("the address of the last administrator is guarded like their identifier", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    await post(edge, "/roles/define", { name: "helper", capabilities: ["moderate"] }, admin.cookie);

    const revoked = await post(
      edge,
      "/roles/revoke",
      { user: "mara@example.edu", context: "commons" },
      admin.cookie,
    );
    // The HTTP edge answers the public category Commons declares for the
    // refusal, which is `CONFLICT` for the last-administrator floor.
    expect(revoked.status).toBe(409);
    expect(revoked.body).toEqual({ error: "CONFLICT" });

    const reassigned = await post(
      edge,
      "/roles/assign",
      { user: "mara@example.edu", context: "commons", role: "helper" },
      admin.cookie,
    );
    expect(reassigned.status).toBe(409);
    expect(reassigned.body).toEqual({ error: "CONFLICT" });

    expect(await roleOf(edge, admin.user, admin.cookie)).toEqual(
      expect.objectContaining({ name: "administrator" }),
    );
  });

  test("a public role read still treats an address as an unmatched string", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const helper = await registerPerson(edge, "kit", "kit@example.edu");
    await post(edge, "/roles/define", { name: "helper", capabilities: ["moderate"] }, admin.cookie);
    await post(
      edge,
      "/roles/assign",
      { user: "kit@example.edu", context: "commons", role: "helper" },
      admin.cookie,
    );

    // No public read resolves an address, so /roles/forUser cannot be used to
    // learn which addresses have accounts.
    expect(await roleOf(edge, "kit@example.edu", admin.cookie)).toEqual({
      role: null,
      name: null,
      capabilities: [],
    });
    expect(await roleOf(edge, helper.user, admin.cookie)).toEqual(
      expect.objectContaining({ name: "helper" }),
    );
  });
});

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
  await app.whenIdle();
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

const activeRoster = async (edge: ReturnType<typeof createEdge>, cookie: string) =>
  (await post(edge, "/roster/list", {}, cookie)).body.members as Record<string, unknown>[];

const pendingRoster = async (edge: ReturnType<typeof createEdge>, cookie: string) =>
  (await post(edge, "/roster/pending", {}, cookie)).body.members as Record<string, unknown>[];

/** Every address Commons has queued invitation mail for. */
const invitedAddresses = async (edge: ReturnType<typeof createEdge>, cookie: string) =>
  ((await post(edge, "/mail/list", {}, cookie)).body.messages as Record<string, unknown>[])
    .filter((message) => message.subject === "Your Commons invitation")
    .map((message) => message.recipient);

describe("adding one person to the roster by hand", () => {
  test("an address that already has an account takes its seat", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const nadia = await registerPerson(edge, "nadia", "nadia@example.edu");

    // The address is typed the way a human types it; every side normalizes it.
    const added = await post(
      edge,
      "/roster/add-person",
      { email: " Nadia@Example.edu ", kind: "STUDENT", displayName: "Nadia Okonkwo" },
      admin.cookie,
    );
    expect(added.status).toBe(200);
    expect(added.body).toEqual({ created: true, account: "LIVE" });

    // The claim commits after the answer, so the rosters are what is asserted.
    await edge.application.whenIdle();
    expect(await activeRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({
        user: nadia.user,
        email: "nadia@example.edu",
        kind: "STUDENT",
        section: null,
      }),
    ]);
    expect(await pendingRoster(edge, admin.cookie)).toEqual([]);
    // Somebody who already has an account is enrolled rather than invited.
    expect(await invitedAddresses(edge, admin.cookie)).toEqual([]);
  });

  test("an address with no account becomes pending and is invited", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    const added = await post(
      edge,
      "/roster/add-person",
      { email: "ola@example.edu", kind: "STUDENT", displayName: "Ola Nord" },
      admin.cookie,
    );
    expect(added.status).toBe(200);
    expect(added.body).toEqual({ created: true, account: "NONE" });

    await edge.application.whenIdle();
    expect(await activeRoster(edge, admin.cookie)).toEqual([]);
    expect(await pendingRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({
        email: "ola@example.edu",
        kind: "STUDENT",
        section: null,
        displayName: "Ola Nord",
      }),
    ]);
    expect(await invitedAddresses(edge, admin.cookie)).toEqual(["ola@example.edu"]);
  });

  test("adding a still-pending address again refreshes only its name", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const created = (
      await post(edge, "/roster/sections/create", { name: "Section A" }, admin.cookie)
    ).body.section as Record<string, unknown>;
    const section = created._id as string;

    expect(
      (
        await post(
          edge,
          "/roster/add-person",
          { email: "pia@example.edu", kind: "STAFF", section, displayName: "Pia" },
          admin.cookie,
        )
      ).body,
    ).toEqual({ created: true, account: "NONE" });
    await edge.application.whenIdle();

    // A second add re-enters the sweep rather than creating a second seat, and
    // the kind and section the seat was created with survive the supplied ones.
    const again = await post(
      edge,
      "/roster/add-person",
      { email: "PIA@example.edu", kind: "STUDENT", displayName: "Pia Berg" },
      admin.cookie,
    );
    expect(again.body).toEqual({ created: false, account: "NONE" });
    await edge.application.whenIdle();

    expect(await pendingRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({
        email: "pia@example.edu",
        kind: "STAFF",
        section,
        displayName: "Pia Berg",
      }),
    ]);
    // Repeating the address does not resend mail to somebody already invited.
    expect(await invitedAddresses(edge, admin.cookie)).toEqual(["pia@example.edu"]);

    // A row carrying no name never clears a name already stored.
    expect(
      (await post(edge, "/roster/add-person", { email: "pia@example.edu" }, admin.cookie)).body,
    ).toEqual({ created: false, account: "NONE" });
    await edge.application.whenIdle();
    expect(await pendingRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({ displayName: "Pia Berg", kind: "STAFF", section }),
    ]);
  });

  test("an active or dropped seat at the address is refused", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    await registerPerson(edge, "quinn", "quinn@example.edu");

    expect(
      (await post(edge, "/roster/add-person", { email: "quinn@example.edu" }, admin.cookie)).body,
    ).toEqual({ created: true, account: "LIVE" });
    await edge.application.whenIdle();

    // Active: the repair is dropping or removing the seat, not adding again.
    const activeAgain = await post(
      edge,
      "/roster/add-person",
      { email: "quinn@example.edu" },
      admin.cookie,
    );
    expect(activeAgain.status).toBe(409);
    expect(activeAgain.body).toEqual({ error: "CONFLICT" });

    const [seat] = await activeRoster(edge, admin.cookie);
    expect((await post(edge, "/roster/drop", { seat: seat.seat }, admin.cookie)).status).toBe(200);

    // Dropped: reinstating is the repair, so the address is refused here too.
    const droppedAgain = await post(
      edge,
      "/roster/add-person",
      { email: "quinn@example.edu" },
      admin.cookie,
    );
    expect(droppedAgain.status).toBe(409);
    expect(droppedAgain.body).toEqual({ error: "CONFLICT" });
    expect(await pendingRoster(edge, admin.cookie)).toEqual([]);
  });

  test("an archived account's address is neither claimed nor invited", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const rex = await registerPerson(edge, "rex", "rex@example.edu");
    expect((await post(edge, "/users/archive", { user: rex.user }, admin.cookie)).status).toBe(200);
    await edge.application.whenIdle();

    const added = await post(
      edge,
      "/roster/add-person",
      { email: "rex@example.edu", displayName: "Rex Ayo" },
      admin.cookie,
    );
    expect(added.body).toEqual({ created: true, account: "ARCHIVED" });
    await edge.application.whenIdle();

    // Inviting is pointless — the address is taken — and claiming would make an
    // active member of somebody who can never sign in.
    expect(await activeRoster(edge, admin.cookie)).toEqual([]);
    expect(await pendingRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({ email: "rex@example.edu", displayName: "Rex Ayo" }),
    ]);
    expect(await invitedAddresses(edge, admin.cookie)).toEqual([]);

    // Restoring the account and adding the address again is the repair.
    expect((await post(edge, "/users/restore", { user: rex.user }, admin.cookie)).status).toBe(200);
    const repaired = await post(
      edge,
      "/roster/add-person",
      { email: "rex@example.edu" },
      admin.cookie,
    );
    expect(repaired.body).toEqual({ created: false, account: "LIVE" });
    await edge.application.whenIdle();
    expect(await activeRoster(edge, admin.cookie)).toEqual([
      expect.objectContaining({ user: rex.user, email: "rex@example.edu" }),
    ]);
  });

  test("the sweep a hand-add re-enters is not attributed to the person added", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    // An earlier import left an address uninvited because it had an account;
    // that account is archived before the sweep could claim it.
    const sara = await registerPerson(edge, "sara", "sara@example.edu");
    await post(edge, "/roster/import", { rows: [{ email: "sara@example.edu" }] }, admin.cookie);
    await edge.application.whenIdle();
    const [claimed] = await activeRoster(edge, admin.cookie);
    expect(claimed).toEqual(expect.objectContaining({ user: sara.user }));
    expect((await post(edge, "/roster/remove", { seat: claimed.seat }, admin.cookie)).status).toBe(
      200,
    );
    await post(edge, "/roster/import", { rows: [{ email: "tess@example.edu" }] }, admin.cookie);
    await edge.application.whenIdle();

    // Adding one person answers for that person alone; what the same sweep did
    // to other pending seats shows up in the rosters and the outbox instead.
    const added = await post(
      edge,
      "/roster/add-person",
      { email: "ulf@example.edu", displayName: "Ulf Marek" },
      admin.cookie,
    );
    expect(added.body).toEqual({ created: true, account: "NONE" });
    await edge.application.whenIdle();
    const invited = (await invitedAddresses(edge, admin.cookie)) as string[];
    expect([...invited].sort((left, right) => left.localeCompare(right))).toEqual([
      "tess@example.edu",
      "ulf@example.edu",
    ]);
  });

  test("a caller without course:manage is refused", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);
    const outsider = await registerPerson(edge, "vic", "vic@example.edu");

    const refused = await post(
      edge,
      "/roster/add-person",
      { email: "wren@example.edu" },
      outsider.cookie,
    );
    expect(refused.status).toBe(403);
    expect(refused.body).toEqual({ error: "FORBIDDEN" });

    await edge.application.whenIdle();
    expect(await pendingRoster(edge, admin.cookie)).toEqual([]);
    expect(await invitedAddresses(edge, admin.cookie)).toEqual([]);
  });
});

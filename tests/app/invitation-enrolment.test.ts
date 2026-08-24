import { afterAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { mongoImplementations } from "../../src/concepts.ts";
import type { CommonsImplementations } from "../../src/assembly/application.ts";
import { invitationCredential } from "../../src/concepts/inviting/credential.ts";
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
const registerAdmin = async (
  app: ReturnType<typeof createEdge>["application"],
  edge: ReturnType<typeof createEdge>,
) => {
  const made = await app.concepts.Authenticating.register({
    username: "mara",
    password: "password123",
    email: "mara@example.edu",
  });
  await app.concepts.Profiling.createProfile({
    user: made.user,
    displayName: "Mara",
  });
  const login = await post(edge, "/auth/login", {
    username: "mara",
    password: "password123",
  });
  return { user: made.user, cookie: login.cookie as string };
};

/** Register an ordinary account that holds no seat and no role. */
const registerPerson = async (
  app: ReturnType<typeof createEdge>["application"],
  edge: ReturnType<typeof createEdge>,
  username: string,
  email: string,
) => {
  const made = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email,
  });
  await app.concepts.Profiling.createProfile({ user: made.user, displayName: username });
  const login = await post(edge, "/auth/login", { username, password: "password123" });
  return { user: made.user, cookie: login.cookie as string };
};

/** Configure the class and publish one assignment released to everyone. */
const publishedAssignment = async (edge: ReturnType<typeof createEdge>, cookie: string) => {
  await post(
    edge,
    "/roster/configure-class",
    { code: "CS101", title: "Intro", term: "Fall", timezone: "UTC" },
    cookie,
  );
  const now = Date.now();
  const draft = await post(
    edge,
    "/assignments/create-draft",
    {
      title: "Homework 1",
      instructions: "Do the problems.",
      kind: "HOMEWORK",
      availableAt: new Date(now - 3_600_000).toISOString(),
      dueAt: new Date(now + 86_400_000).toISOString(),
      closeAt: new Date(now + 172_800_000).toISOString(),
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
    },
    cookie,
  );
  expect(draft.status).toBe(200);
  const assignment = draft.body.assignment as string;
  expect((await post(edge, "/assignments/publish", { assignment }, cookie)).status).toBe(200);
  return assignment;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

const floorCases: [string, () => Promise<CommonsImplementations>][] = [
  ["on MongoDB", async () => mongoImplementations(await testDb())],
];

for (const [floor, makeFloor] of floorCases) {
  describe(`invitation enrolment ${floor}`, () => {
    test("importing a roster invites each address exactly once", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      const first = await post(
        edge,
        "/roster/import",
        { rows: [{ email: "ana@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      expect(first.status).toBe(200);

      const invited = await app.concepts.Inviting._getInvitationByAddress({
        channel: "email",
        address: "ana@example.edu",
      });
      expect(invited).toHaveLength(1);

      // A repeated import must not resend mail to somebody already invited.
      const before = inspectAssembly(app).occurrences.length;
      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "ana@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      const reinvites = inspectAssembly(app)
        .occurrences.slice(before)
        .filter((event) => event.concept === "Inviting" && event.action === "invite");
      expect(reinvites).toHaveLength(0);
    });

    test("accepting the invitation claims the seat held for that address", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "ben@example.edu", kind: "STUDENT", section: null }] },
        admin.cookie,
      );

      const [invitation] = await app.concepts.Inviting._getInvitationByAddress({
        channel: "email",
        address: "ben@example.edu",
      });
      expect(invitation).toBeDefined();

      const accepted = await post(edge, "/auth/accept-invitation", {
        invitation: invitation.invitation,
        temporaryPassword: invitationCredential(invitation.invitation),
        username: "ben",
        password: invitationCredential(invitation.invitation),
        displayName: "Ben",
      });
      expect(accepted.status).toBe(200);
      const user = accepted.body.user as string;

      await new Promise((resolve) => setTimeout(resolve, 20));

      // No manual link step: the seat is active and held by the new account.
      expect(await app.concepts.Rostering._getSeatByUser({ user })).toEqual([
        expect.objectContaining({ email: "ben@example.edu", status: "ACTIVE", user }),
      ]);
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toEqual([]);
    });

    test("an invitation with no seat still creates the account and leaves the roster alone", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      const invited = await post(
        edge,
        "/invitations/invite",
        { email: "cai@example.edu" },
        admin.cookie,
      );
      expect(invited.status).toBe(200);
      const invitation = invited.body.invitation as string;

      const accepted = await post(edge, "/auth/accept-invitation", {
        invitation,
        temporaryPassword: invitationCredential(invitation),
        username: "cai",
        password: invitationCredential(invitation),
        displayName: "Cai",
      });
      expect(accepted.status).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(
        await app.concepts.Rostering._getSeatByUser({
          user: accepted.body.user as string,
        }),
      ).toEqual([]);
    });

    test("an imported address that already has a live account claims its seat at once", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);
      const assignment = await publishedAssignment(edge, admin.cookie);
      const nadia = await registerPerson(app, edge, "nadia", "nadia@example.edu");

      // The row spells the address differently; every side normalizes it.
      const imported = await post(
        edge,
        "/roster/import",
        { rows: [{ email: " Nadia@Example.EDU ", kind: "STUDENT" }] },
        admin.cookie,
      );
      expect(imported.status).toBe(200);
      await settle();

      // Nobody invites somebody who already has an account.
      expect(
        await app.concepts.Inviting._getInvitationByAddress({
          channel: "email",
          address: "nadia@example.edu",
        }),
      ).toEqual([]);
      // The seat is active for that account, and nothing is left pending.
      expect(await app.concepts.Rostering._getSeatByUser({ user: nadia.user })).toEqual([
        expect.objectContaining({ email: "nadia@example.edu", status: "ACTIVE", user: nadia.user }),
      ]);
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toEqual([]);
      // The sweep claims rather than enrols, so the work already published
      // reaches the student it just enrolled.
      expect(
        await app.concepts.Assigning._isAssigned({ assignment, assignee: nadia.user }),
      ).toEqual({ assigned: true });
    });

    test("an imported address with no account is invited and its seat stays pending", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      expect(
        (
          await post(
            edge,
            "/roster/import",
            { rows: [{ email: "omar@example.edu", kind: "STUDENT" }] },
            admin.cookie,
          )
        ).status,
      ).toBe(200);
      await settle();

      expect(
        await app.concepts.Inviting._getInvitationByAddress({
          channel: "email",
          address: "omar@example.edu",
        }),
      ).toHaveLength(1);
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toEqual([
        expect.objectContaining({ email: "omar@example.edu" }),
      ]);
    });

    test("an imported address held by an archived account is neither invited nor claimed", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);
      const pia = await registerPerson(app, edge, "pia", "pia@example.edu");
      expect((await post(edge, "/users/archive", { user: pia.user }, admin.cookie)).status).toBe(
        200,
      );

      expect(
        (
          await post(
            edge,
            "/roster/import",
            { rows: [{ email: "pia@example.edu", kind: "STUDENT" }] },
            admin.cookie,
          )
        ).status,
      ).toBe(200);
      await settle();

      // Inviting would be pointless and claiming would make an active member of
      // somebody who can never sign in, so the seat waits in the pending roster.
      expect(
        await app.concepts.Inviting._getInvitationByAddress({
          channel: "email",
          address: "pia@example.edu",
        }),
      ).toEqual([]);
      expect(await app.concepts.Rostering._getSeatByUser({ user: pia.user })).toEqual([]);
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toEqual([
        expect.objectContaining({ email: "pia@example.edu" }),
      ]);

      // Restoring the account and importing again is the repair.
      expect((await post(edge, "/users/restore", { user: pia.user }, admin.cookie)).status).toBe(
        200,
      );
      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "pia@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      expect(await app.concepts.Rostering._getSeatByUser({ user: pia.user })).toEqual([
        expect.objectContaining({ status: "ACTIVE", user: pia.user }),
      ]);
    });

    test("every import sweeps every pending seat, so re-importing is a real retry", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "quinn@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toHaveLength(1);

      // Quinn registers by some other route than the invitation.
      const quinn = await registerPerson(app, edge, "quinn", "quinn@example.edu");

      // Importing an unrelated address sweeps Quinn's older pending seat too.
      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "rhea@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      expect(await app.concepts.Rostering._getSeatByUser({ user: quinn.user })).toEqual([
        expect.objectContaining({ email: "quinn@example.edu", status: "ACTIVE" }),
      ]);
    });

    test("accepting an invitation to an address some account already holds is refused", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);
      const sam = await registerPerson(app, edge, "sam", "sam@example.edu");

      const invited = await post(
        edge,
        "/invitations/invite",
        { email: "sam@example.edu" },
        admin.cookie,
      );
      expect(invited.status).toBe(200);
      const invitation = invited.body.invitation as string;

      const accepted = await post(edge, "/auth/accept-invitation", {
        invitation,
        temporaryPassword: invitationCredential(invitation),
        username: "sam2",
        password: invitationCredential(invitation),
        displayName: "Sam Again",
      });
      expect(accepted.status).toBe(409);
      expect(accepted.body).toEqual({ error: "CONFLICT" });

      // No second account took the address, and the invitation is still unclaimed.
      expect(await app.concepts.Authenticating._getByEmail({ email: "sam@example.edu" })).toEqual([
        { user: sam.user },
      ]);
      expect(await app.concepts.Authenticating._getByUsername({ username: "sam2" })).toEqual([]);
      expect(
        await app.concepts.Inviting._getInvitationByAddress({
          channel: "email",
          address: "sam@example.edu",
        }),
      ).toEqual([expect.objectContaining({ invitation, user: null })]);
    });

    test("removing a seat frees the address and leaves the account and its course records intact", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);
      const assignment = await publishedAssignment(edge, admin.cookie);
      const tara = await registerPerson(app, edge, "tara", "tara@example.edu");

      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "tara@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      const [seated] = await app.concepts.Rostering._getSeatByUser({ user: tara.user });
      expect(seated).toEqual(expect.objectContaining({ status: "ACTIVE" }));

      const submitted = await post(
        edge,
        "/assignments/submit",
        { assignment, content: "My answer" },
        tara.cookie,
      );
      expect(submitted.status).toBe(200);
      const item = await post(
        edge,
        "/grades/configure-item",
        { item: assignment, label: "Homework 1", maxPoints: 10 },
        admin.cookie,
      );
      expect(item.status).toBe(200);
      const recorded = await post(
        edge,
        "/grades/record",
        { item: assignment, learner: tara.user, score: 9, feedback: "Good" },
        admin.cookie,
      );
      expect(recorded.status).toBe(200);
      const released = await post(
        edge,
        "/grades/release",
        { item: assignment, learner: tara.user },
        admin.cookie,
      );
      expect(released.status).toBe(200);
      const granted = await post(
        edge,
        "/late-days/grant",
        { learner: tara.user, days: 2, reason: "Illness" },
        admin.cookie,
      );
      expect(granted.status).toBe(200);
      // Design promises grants *and uses* survive, so spend one of the granted
      // days while the seat is still active.
      const applied = await post(edge, "/late-days/apply", { assignment, days: 1 }, tara.cookie);
      expect(applied.status).toBe(200);
      const note = await post(
        edge,
        "/students/notes/write",
        {
          learner: tara.user,
          body: "Checked in after the deadline.",
          visibility: "STAFF_ONLY",
          tags: [],
          followUpAt: null,
        },
        admin.cookie,
      );
      expect(note.status).toBe(200);

      const removed = await post(edge, "/roster/remove", { seat: seated.seat }, admin.cookie);
      expect(removed.status).toBe(200);
      // The endpoint answers which address it freed, because no read can report
      // it once the seat is gone.
      expect(removed.body.email).toBe("tara@example.edu");
      await settle();

      // The seat is gone in every state it could be read from.
      expect(await app.concepts.Rostering._getSeatByUser({ user: tara.user })).toEqual([]);
      expect(await app.concepts.Rostering._getSeatByEmail({ email: "tara@example.edu" })).toEqual(
        [],
      );
      expect(await app.concepts.Rostering._getUnclaimedSeats({})).toEqual([]);
      expect(await app.concepts.Rostering._getDroppedSeats({})).toEqual([]);

      // The account survives untouched and can still sign in.
      const me = await post(edge, "/auth/me", {}, tara.cookie);
      expect(me.status).toBe(200);
      expect(me.body).toEqual(expect.objectContaining({ user: tara.user, username: "tara" }));

      // Every course record keyed to that account is retained.
      expect(await app.concepts.Assigning._isAssigned({ assignment, assignee: tara.user })).toEqual(
        { assigned: true },
      );
      expect(
        await app.concepts.Submitting._getSubmissionsForSubmitter({ submitter: tara.user }),
      ).toHaveLength(1);
      expect(await app.concepts.Grading._getGradesForLearner({ learner: tara.user })).toHaveLength(
        1,
      );
      expect(await app.concepts.Banking._getGrants({ learner: tara.user })).toHaveLength(1);
      expect(await app.concepts.Banking._getUses({ learner: tara.user })).toEqual([
        expect.objectContaining({ item: assignment, days: 1, status: "APPLIED" }),
      ]);
      expect(await app.concepts.Noting._getActiveNotesFor({ learner: tara.user })).toHaveLength(1);

      // The address is free again, so a later import gives it a fresh seat.
      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "tara@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      const [again] = await app.concepts.Rostering._getSeatByUser({ user: tara.user });
      expect(again).toEqual(expect.objectContaining({ status: "ACTIVE" }));
      expect(again.seat).not.toBe(seated.seat);

      // A person added again later reads their earlier work: the reads that
      // gate on an active seat answer once more, and answer with what was there
      // before the seat was removed.
      const myAssignments = await post(edge, "/assignments/for-me", {}, tara.cookie);
      expect(myAssignments.status).toBe(200);
      expect(myAssignments.body.assignments).toEqual([
        expect.objectContaining({ assignment, release: expect.any(String) }),
      ]);
      const myGrades = await post(edge, "/grades/for-me", {}, tara.cookie);
      expect(myGrades.status).toBe(200);
      expect(myGrades.body.grades).toEqual([
        expect.objectContaining({ item: assignment, score: 9 }),
      ]);
      const myLateDays = await post(edge, "/late-days/list", {}, tara.cookie);
      expect(myLateDays.status).toBe(200);
      expect(myLateDays.body.uses).toEqual([
        expect.objectContaining({ item: assignment, days: 1, status: "APPLIED" }),
      ]);
    });

    test("removing a seat that is already gone answers SEAT_NOT_FOUND", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      await post(
        edge,
        "/roster/import",
        { rows: [{ email: "ula@example.edu", kind: "STUDENT" }] },
        admin.cookie,
      );
      await settle();
      const [pending] = await app.concepts.Rostering._getUnclaimedSeats({});

      expect(
        (await post(edge, "/roster/remove", { seat: pending.seat }, admin.cookie)).status,
      ).toBe(200);
      const again = await post(edge, "/roster/remove", { seat: pending.seat }, admin.cookie);
      expect(again.status).toBe(404);
      expect(again.body).toEqual({ error: "NOT_FOUND" });
    });

    test("the class can be revised afterwards but not before it is configured", async () => {
      const edge = createEdge(await makeFloor());
      const app = edge.application;
      const admin = await registerAdmin(app, edge);

      const early = await post(
        edge,
        "/roster/update-class",
        { code: "CS101", title: "Intro", term: "Fall", timezone: "UTC" },
        admin.cookie,
      );
      expect(early.status).toBe(409);
      expect(early.body).toEqual({ error: "CONFLICT" });

      expect(
        (
          await post(
            edge,
            "/roster/configure-class",
            { code: "CS101", title: "Intro", term: "Fall", timezone: "UTC" },
            admin.cookie,
          )
        ).status,
      ).toBe(200);

      const revised = await post(
        edge,
        "/roster/update-class",
        { code: "CS101", title: "Intro to Commons", term: "Spring", timezone: "Europe/Berlin" },
        admin.cookie,
      );
      expect(revised.status).toBe(200);
      expect(await app.concepts.Rostering._getClass({})).toEqual([
        {
          detail: expect.objectContaining({
            code: "CS101",
            title: "Intro to Commons",
            term: "Spring",
            timezone: "Europe/Berlin",
          }),
        },
      ]);
    });
  });
}

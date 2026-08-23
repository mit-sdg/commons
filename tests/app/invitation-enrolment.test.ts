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
    email: "mara@example.edu",
  });
  const login = await post(edge, "/auth/login", {
    username: "mara",
    password: "password123",
  });
  return { user: made.user, cookie: login.cookie as string };
};

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
  });
}

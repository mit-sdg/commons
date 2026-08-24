import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
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

/**
 * The invitation read answers without a session, so it is asked of the assembled
 * application rather than through the browser edge, whose gate still expects a
 * cookie on every served path it does not list as public.
 */
const readDetails = async (
  edge: ReturnType<typeof createEdge>,
  invitation: string,
  temporaryPassword: string,
): Promise<Record<string, unknown>> => {
  const result = await edge.application.invoker.invoke("/auth/invitation", {
    invitation,
    temporaryPassword,
  } as never);
  return result.ok
    ? (result.value as Record<string, unknown>)
    : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
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

const invitationFor = async (edge: ReturnType<typeof createEdge>, address: string) => {
  const [issued] = await edge.application.concepts.Inviting._getInvitationByAddress({
    channel: "email",
    address,
  });
  expect(issued).toBeDefined();
  return issued.invitation;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("the invitation a registration form arrives holding", () => {
  test("answers the invited address with the name the roster holds for it", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    const imported = await post(
      edge,
      "/roster/import",
      {
        rows: [
          { email: "nina@example.edu", kind: "STUDENT", displayName: "Nina Okafor" },
          { email: "quiet@example.edu", kind: "STUDENT" },
        ],
      },
      admin.cookie,
    );
    expect(imported.status).toBe(200);
    await settle();

    const named = await invitationFor(edge, "nina@example.edu");
    expect(await readDetails(edge, named, invitationCredential(named))).toEqual({
      invitation: { email: "nina@example.edu", displayName: "Nina Okafor" },
    });

    // A seat listed without a name answers an empty one.
    const nameless = await invitationFor(edge, "quiet@example.edu");
    expect(await readDetails(edge, nameless, invitationCredential(nameless))).toEqual({
      invitation: { email: "quiet@example.edu", displayName: "" },
    });
  });

  test("an invitation the roster holds no seat for answers an empty name too", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    const invited = await post(
      edge,
      "/invitations/invite",
      { email: "cai@example.edu" },
      admin.cookie,
    );
    expect(invited.status).toBe(200);
    const invitation = invited.body.invitation as string;

    // No seat at all and a seat carrying no name are deliberately alike, so a
    // holder learns nothing about the roster from the difference.
    expect(await readDetails(edge, invitation, invitationCredential(invitation))).toEqual({
      invitation: { email: "cai@example.edu", displayName: "" },
    });
  });

  test("a name typed for one address never reaches another invitation", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    await post(
      edge,
      "/roster/import",
      {
        rows: [
          { email: "rosa@example.edu", kind: "STUDENT", displayName: "Rosa Lin" },
          { email: "sam@example.edu", kind: "STAFF", displayName: "Sam Ito" },
        ],
      },
      admin.cookie,
    );
    await settle();

    const rosa = await invitationFor(edge, "rosa@example.edu");
    const sam = await invitationFor(edge, "sam@example.edu");
    expect(await readDetails(edge, rosa, invitationCredential(rosa))).toEqual({
      invitation: { email: "rosa@example.edu", displayName: "Rosa Lin" },
    });
    expect(await readDetails(edge, sam, invitationCredential(sam))).toEqual({
      invitation: { email: "sam@example.edu", displayName: "Sam Ito" },
    });
  });

  test("unknown, wrongly credentialed, and claimed invitations refuse alike", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    await post(
      edge,
      "/roster/import",
      { rows: [{ email: "tom@example.edu", kind: "STUDENT", displayName: "Tom Ray" }] },
      admin.cookie,
    );
    await settle();
    const invitation = await invitationFor(edge, "tom@example.edu");
    const credential = invitationCredential(invitation);

    const unknown = await readDetails(edge, crypto.randomUUID(), credential);
    const wrongCredential = await readDetails(edge, invitation, "C-not-the-credential");

    const accepted = await post(edge, "/auth/accept-invitation", {
      invitation,
      temporaryPassword: credential,
      username: "tom",
      password: "password123",
      displayName: "Tom Ray",
    });
    expect(accepted.status).toBe(200);
    const claimed = await readDetails(edge, invitation, credential);

    expect(unknown).toEqual({ error: "INVITATION_INVALID" });
    expect(wrongCredential).toEqual(unknown);
    expect(claimed).toEqual(unknown);
  });

  test("the read discloses nothing without the credential the mail carried", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const admin = await registerAdmin(edge);

    await post(
      edge,
      "/roster/import",
      { rows: [{ email: "una@example.edu", kind: "STUDENT", displayName: "Una Vale" }] },
      admin.cookie,
    );
    await settle();
    const invitation = await invitationFor(edge, "una@example.edu");

    // The invitation identifier travels in the link; the credential does not.
    expect(await readDetails(edge, invitation, invitation)).toEqual({
      error: "INVITATION_INVALID",
    });
  });
});

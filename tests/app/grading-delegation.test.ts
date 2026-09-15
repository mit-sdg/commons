import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

type Edge = ReturnType<typeof createEdge>;

const post = async (
  edge: Edge,
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; body: Record<string, unknown> }> => {
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
  };
};

const login = async (edge: Edge, username: string) => {
  const response = await edge.fetch(
    new Request("http://commons.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    }),
  );
  return response.headers.get("set-cookie")?.split(";")[0] as string;
};

const register = async (edge: Edge, username: string, displayName: string) => {
  const made = await edge.application.concepts.Authenticating.register({
    username,
    password: "password123",
    email: `${username}@example.edu`,
  });
  await edge.application.concepts.Profiling.createProfile({
    user: made.user,
    displayName,
  });
  await edge.application.whenIdle();
  return { user: made.user, cookie: await login(edge, username) };
};

const classroom = async () => {
  const edge = createEdge(mongoImplementations(await testDb()));
  const mara = await register(edge, "mara", "Mara Adeyemi");
  const noah = await register(edge, "noah", "Noah Brandt");
  const priya = await register(edge, "priya", "Priya Raman");
  const omar = await register(edge, "omar", "Omar Haddad");
  const dana = await register(edge, "dana", "Dana Ingram");

  await post(
    edge,
    "/roster/configure-class",
    {
      code: "6.1040",
      title: "Software Design",
      term: "Fall 2026",
      timezone: "America/New_York",
    },
    mara.cookie,
  );
  const sectionResult = await post(
    edge,
    "/roster/sections/create",
    { name: "Recitation A", location: "32-123", meetingPattern: "TR 10" },
    mara.cookie,
  );
  const section = String((sectionResult.body.section as { _id: string })._id);
  for (const student of [priya, omar, dana]) {
    await post(
      edge,
      "/roster/add-person",
      {
        email: `${student === priya ? "priya" : student === omar ? "omar" : "dana"}@example.edu`,
        kind: "STUDENT",
        section,
        displayName: "student",
      },
      mara.cookie,
    );
  }
  const graderRole = String(
    (
      await post(
        edge,
        "/roles/define",
        { name: "teaching assistant", capabilities: ["grade"] },
        mara.cookie,
      )
    ).body.role,
  );
  await post(
    edge,
    "/roles/assign",
    { user: "noah@example.edu", context: "commons", role: graderRole },
    mara.cookie,
  );
  const assignment = String(
    (
      await post(
        edge,
        "/assignments/create-draft",
        {
          title: "Problem set 1",
          instructions: "Explain your claim",
          kind: "EXERCISE",
          availableAt: "2020-01-01T00:00:00Z",
          dueAt: "2090-01-01T00:00:00Z",
          acceptsSubmissions: true,
          audience: "EVERYONE",
          targets: [],
        },
        mara.cookie,
      )
    ).body.assignment,
  );
  await post(edge, "/assignments/publish", { assignment }, mara.cookie);
  await edge.application.whenIdle();
  return { edge, mara, noah, priya, omar, dana, assignment, section, graderRole };
};

describe("grading delegation HTTP boundary", () => {
  test("uses grade capability rather than roster title and hides every route from students", async () => {
    const { edge, mara, noah, priya, assignment } = await classroom();

    expect((await post(edge, "/delegation/graders", {}, mara.cookie)).body).toEqual({
      graders: [
        { grader: mara.user, displayName: "Mara Adeyemi", username: "mara" },
        { grader: noah.user, displayName: "Noah Brandt", username: "noah" },
      ],
    });

    for (const [path, body] of [
      ["/delegation/graders", {}],
      ["/delegation/for-item", { item: assignment }],
      ["/delegation/set", { item: assignment, learner: priya.user, grader: noah.user }],
      [
        "/delegation/spread",
        {
          item: assignment,
          learners: [priya.user],
          graders: [noah.user],
          replace: false,
        },
      ],
    ] as const) {
      expect(await post(edge, path, body, priya.cookie), path).toMatchObject({
        status: 403,
        body: { error: "FORBIDDEN" },
      });
    }
  });

  test("validates assignment, learner, and active grader identities before mutation", async () => {
    const { edge, mara, noah, priya, assignment } = await classroom();

    for (const body of [
      { item: "missing", learner: priya.user, grader: noah.user },
      { item: assignment, learner: mara.user, grader: noah.user },
      { item: assignment, learner: priya.user, grader: "missing" },
      { item: assignment, learner: priya.user, grader: priya.user },
    ]) {
      expect(await post(edge, "/delegation/set", body, mara.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    }
    expect(
      await post(edge, "/delegation/for-item", { item: "missing" }, mara.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(
      (await post(edge, "/delegation/for-item", { item: assignment }, mara.cookie)).body,
    ).toEqual({ delegations: [] });
  });

  test("rejects malformed batch fields before queries and leaves state unchanged", async () => {
    const { edge, mara, noah, priya, assignment } = await classroom();
    const malformed = [
      {
        item: { $ne: "" },
        learners: [priya.user],
        graders: [noah.user],
        replace: false,
      },
      { learners: null, graders: [noah.user], replace: false },
      { learners: [priya.user], graders: null, replace: false },
      { learners: "not-an-array", graders: [noah.user], replace: false },
      { learners: [priya.user], graders: "not-an-array", replace: false },
      { learners: [priya.user, priya.user], graders: [noah.user], replace: false },
      { learners: [priya.user], graders: [noah.user, noah.user], replace: false },
      { learners: [priya.user], graders: [noah.user], replace: "false" },
      { learners: [priya.user], graders: [noah.user], replace: null },
    ];

    for (const input of malformed) {
      expect(
        await post(edge, "/delegation/spread", { item: assignment, ...input }, mara.cookie),
      ).toMatchObject({ status: 400, body: { error: "INVALID_REQUEST" } });
    }
    expect(
      (await post(edge, "/delegation/for-item", { item: assignment }, mara.cookie)).body,
    ).toEqual({ delegations: [] });

    for (const [path, body] of [
      ["/delegation/for-item", { item: { $ne: "" } }],
      ["/delegation/clear-item", { item: { $ne: "" } }],
      ["/delegation/clear", { item: assignment, learner: { $ne: "" } }],
      ["/delegation/set", { item: assignment, learner: priya.user, grader: { $ne: "" } }],
    ] as const) {
      expect(await post(edge, path, body, mara.cookie), path).toMatchObject({
        status: 400,
        body: { error: "INVALID_REQUEST" },
      });
    }
  });

  test("default spread preserves ownership while explicit spread redistributes evenly", async () => {
    const { edge, mara, noah, priya, omar, dana, assignment } = await classroom();

    await post(
      edge,
      "/delegation/set",
      { item: assignment, learner: priya.user, grader: mara.user },
      mara.cookie,
    );
    expect(
      (
        await post(
          edge,
          "/delegation/spread",
          {
            item: assignment,
            learners: [priya.user, omar.user, dana.user],
            graders: [mara.user, noah.user],
            replace: false,
          },
          mara.cookie,
        )
      ).body,
    ).toEqual({
      assigned: [
        { subject: omar.user, delegate: noah.user },
        { subject: dana.user, delegate: mara.user },
      ],
    });
    expect(
      (
        await post(
          edge,
          "/delegation/spread",
          {
            item: assignment,
            learners: [priya.user, omar.user, dana.user],
            graders: [mara.user, noah.user],
            replace: true,
          },
          mara.cookie,
        )
      ).body,
    ).toEqual({
      assigned: [
        { subject: priya.user, delegate: mara.user },
        { subject: omar.user, delegate: noah.user },
        { subject: dana.user, delegate: mara.user },
      ],
    });
  });

  test("revoked graders remain visible as unavailable ownership and can be replaced", async () => {
    const { edge, mara, noah, priya, assignment } = await classroom();
    await post(
      edge,
      "/delegation/set",
      { item: assignment, learner: priya.user, grader: noah.user },
      mara.cookie,
    );
    await post(edge, "/roles/revoke", { user: noah.user, context: "commons" }, mara.cookie);

    expect((await post(edge, "/delegation/graders", {}, mara.cookie)).body).toEqual({
      graders: [{ grader: mara.user, displayName: "Mara Adeyemi", username: "mara" }],
    });
    expect(
      (await post(edge, "/delegation/for-item", { item: assignment }, mara.cookie)).body,
    ).toEqual({
      delegations: [
        {
          learner: priya.user,
          grader: noah.user,
          graderName: "Noah Brandt",
          graderUsername: "noah",
        },
      ],
    });
    expect(
      await post(
        edge,
        "/delegation/set",
        { item: assignment, learner: priya.user, grader: noah.user },
        mara.cookie,
      ),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(
      await post(
        edge,
        "/delegation/set",
        { item: assignment, learner: priya.user, grader: mara.user },
        mara.cookie,
      ),
    ).toMatchObject({ status: 200 });
  });

  test("delegation survives resubmission and does not constrain grading access", async () => {
    const { edge, mara, noah, priya, assignment } = await classroom();
    await post(
      edge,
      "/delegation/set",
      { item: assignment, learner: priya.user, grader: noah.user },
      mara.cookie,
    );
    await post(edge, "/assignments/submit", { assignment, content: "First answer" }, priya.cookie);
    await post(edge, "/assignments/submit", { assignment, content: "Second answer" }, priya.cookie);

    expect(
      (await post(edge, "/delegation/for-item", { item: assignment }, mara.cookie)).body,
    ).toMatchObject({
      delegations: [{ learner: priya.user, grader: noah.user }],
    });
    expect(
      (await post(edge, "/submissions/for-assignment", { assignment }, mara.cookie)).body,
    ).toMatchObject({
      submissions: [
        { submitter: priya.user, number: 1 },
        { submitter: priya.user, number: 2 },
      ],
    });
  });
});

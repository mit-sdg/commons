import { afterAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { mongoImplementations } from "../../src/assembly/concept-floor.ts";
import { assembleCommons, type CommonsOverrides } from "../../src/assembly/application.ts";
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

const register = async (edge: ReturnType<typeof createEdge>, username: string, email: string) => {
  const made = await post(edge, "/auth/register", {
    username,
    password: "password123",
    displayName: username,
    email,
  });
  const login = await post(edge, "/auth/login", { username, password: "password123" });
  return {
    user: made.body.user as string,
    cookie: login.cookie as string,
  };
};

const floorCases: [string, string, () => Promise<CommonsOverrides>][] = [
  ["in memory", "memory", async () => ({})],
  ["on MongoDB", "mongo", async () => mongoImplementations(await testDb())],
];

for (const [floor, prefix, makeFloor] of floorCases) {
  describe(`seat-claim identity ${floor}`, () => {
    test("a matching claim emits one response and leaves no occurrence unanswered", async () => {
      const edge = createEdge(await makeFloor());
      const manager = await register(
        edge,
        `${prefix}_clean_manager`,
        `${prefix}-clean-manager@example.edu`,
      );
      const learner = await register(
        edge,
        `${prefix}_clean_learner`,
        `${prefix}-clean-learner@example.edu`,
      );
      const { role } = await edge.application.concepts.Roling.ensureRole({
        name: `${prefix}-clean-roster-manager`,
        capabilities: ["roster:manage"],
      });
      await edge.application.concepts.Roling.grant({
        user: manager.user,
        context: "forum",
        role,
      });
      const imported = await post(
        edge,
        "/roster/import",
        {
          rows: [
            {
              externalKey: `${prefix}-clean-learner-key`,
              email: `${prefix}-clean-learner@example.edu`,
              rosterName: "Clean learner",
              kind: "STUDENT",
            },
          ],
        },
        manager.cookie,
      );
      expect(imported.status).toBe(200);

      const before = inspectAssembly(edge.application).occurrences.length;
      const claimed = await post(
        edge,
        "/roster/claim-seat",
        { externalKey: `${prefix}-clean-learner-key` },
        learner.cookie,
      );
      expect(claimed).toMatchObject({
        status: 200,
        body: { seat: { user: learner.user, kind: "STUDENT" } },
      });

      await new Promise((resolve) => setTimeout(resolve, 20));
      const emitted = inspectAssembly(edge.application).occurrences.slice(before);
      expect(emitted.filter((event) => event.outcome === undefined)).toHaveLength(0);
      const responses = emitted.filter(
        (event) => event.concept === "RequestBoundary" && event.action === "respond",
      );
      expect(responses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
      expect(responses.filter((event) => event.outcome?.kind === "error")).toHaveLength(0);
    });

    test("rejects mismatched learner and staff claims without revealing which key exists", async () => {
      const edge = createEdge(await makeFloor());
      const manager = await register(edge, `${prefix}_manager`, `${prefix}-manager@example.edu`);
      const learner = await register(edge, `${prefix}_learner`, `${prefix}-learner@example.edu`);
      const staff = await register(edge, `${prefix}_staff`, `${prefix}-staff@example.edu`);
      const attacker = await register(edge, `${prefix}_attacker`, `${prefix}-attacker@example.edu`);
      const linked = await register(edge, `${prefix}_linked`, `${prefix}-linked@example.edu`);

      const role = await post(
        edge,
        "/roles/define",
        { name: `${prefix}-roster-manager`, capabilities: ["roster:manage"] },
        manager.cookie,
      );
      await post(
        edge,
        "/roles/grant",
        { user: manager.user, context: "forum", role: role.body.role },
        manager.cookie,
      );
      const imported = await post(
        edge,
        "/roster/import",
        {
          rows: [
            {
              externalKey: `${prefix}-learner-key`,
              email: `${prefix}-learner@example.edu`,
              rosterName: "Learner",
              kind: "STUDENT",
            },
            {
              externalKey: `${prefix}-staff-key`,
              email: `${prefix}-staff@example.edu`,
              rosterName: "Staff",
              kind: "STAFF",
            },
            {
              externalKey: `${prefix}-managed-key`,
              email: `${prefix}-different-account@example.edu`,
              rosterName: "Managed learner",
              kind: "STUDENT",
            },
          ],
        },
        manager.cookie,
      );
      expect(imported.status).toBe(200);

      const mismatchedLearner = await post(
        edge,
        "/roster/claim-seat",
        { externalKey: `${prefix}-learner-key` },
        attacker.cookie,
      );
      const unknown = await post(
        edge,
        "/roster/claim-seat",
        { externalKey: `${prefix}-unknown-key` },
        attacker.cookie,
      );
      const mismatchedStaff = await post(
        edge,
        "/roster/claim-seat",
        { externalKey: `${prefix}-staff-key` },
        attacker.cookie,
      );
      expect(mismatchedLearner).toEqual(unknown);
      expect(mismatchedStaff).toEqual(unknown);
      expect(unknown).toEqual({
        status: 404,
        body: { error: "NOT_FOUND" },
        cookie: undefined,
      });
      expect(JSON.stringify(unknown)).not.toMatch(/email|token/i);
      expect(
        await post(
          edge,
          "/roles/can",
          { user: attacker.user, context: "forum", capability: "roster:manage" },
          attacker.cookie,
        ),
      ).toMatchObject({ status: 200, body: { allowed: false } });
      expect(await post(edge, "/roster/me", {}, attacker.cookie)).toMatchObject({
        status: 200,
        body: { seat: null },
      });

      expect(
        await post(
          edge,
          "/roster/claim-seat",
          { externalKey: `${prefix}-learner-key` },
          learner.cookie,
        ),
      ).toMatchObject({ status: 200, body: { seat: { user: learner.user, kind: "STUDENT" } } });
      expect(
        await post(
          edge,
          "/roster/claim-seat",
          { externalKey: `${prefix}-staff-key` },
          staff.cookie,
        ),
      ).toMatchObject({ status: 200, body: { seat: { user: staff.user, kind: "STAFF" } } });
      expect(
        await post(
          edge,
          "/roles/can",
          { user: staff.user, context: "forum", capability: "roster:manage" },
          staff.cookie,
        ),
      ).toMatchObject({ status: 200, body: { allowed: true } });

      const managedSeat = (imported.body.created as { _id: string }[])[2]._id;
      expect(
        await post(
          edge,
          "/roster/link-user",
          { seat: managedSeat, user: linked.user },
          manager.cookie,
        ),
      ).toMatchObject({ status: 200, body: { seat: { user: linked.user } } });
      expect(await post(edge, "/roster/me", {}, linked.cookie)).toMatchObject({
        status: 200,
        body: { seat: managedSeat },
      });
    });
  });
}

test("a mismatched claim retains no compared email and emits one public response", async () => {
  const app = assembleCommons();
  const send = async (path: string, body: Record<string, unknown>) =>
    app.invoker.invoke(path, body as never);
  const actor = async (username: string, email: string) => {
    const registered = await send("/auth/register", {
      username,
      password: "password123",
      displayName: username,
      email,
    });
    const login = await send("/auth/login", { username, password: "password123" });
    if (!registered.ok || !login.ok) throw new Error(`could not create ${username}`);
    return {
      user: (registered.value as { user: string }).user,
      session: (login.value as { session: string }).session,
    };
  };
  const manager = await actor("claim_observer_manager", "manager@example.edu");
  const attacker = await actor("claim_observer_attacker", "attacker@example.edu");
  const { role } = await app.concepts.Roling.ensureRole({
    name: "claim-observer-manager",
    capabilities: ["roster:manage"],
  });
  await app.concepts.Roling.grant({ user: manager.user, context: "forum", role });
  await send("/roster/import", {
    session: manager.session,
    rows: [
      {
        externalKey: "observed-staff-key",
        email: "victim-email-sentinel@example.edu",
        rosterName: "Observed staff",
        kind: "STAFF",
      },
    ],
  });

  const before = inspectAssembly(app).occurrences.length;
  const denied = await send("/roster/claim-seat", {
    session: attacker.session,
    externalKey: "observed-staff-key",
  });
  expect(denied).toMatchObject({ ok: false, error: { kind: "domain", value: "SEAT_NOT_FOUND" } });

  const retained = inspectAssembly(app).occurrences.slice(before);
  const captured = JSON.stringify(retained);
  expect(captured).not.toContain("victim-email-sentinel@example.edu");
  expect(captured).not.toContain("attacker@example.edu");
  expect(captured).not.toMatch(/claimToken|"token"/i);
  expect(
    retained.filter((event) => event.concept === "Rostering" && event.action === "claimSeat"),
  ).toHaveLength(0);
  const responses = retained.filter(
    (event) => event.concept === "RequestBoundary" && event.action === "respond",
  );
  expect(responses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
  expect(responses.filter((event) => event.outcome?.kind === "error")).toHaveLength(0);
});

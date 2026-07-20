import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/assembly/concept-floor.ts";
import { assembleCommons } from "../../src/assembly/application.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

describe("MongoDB authorization and privacy", () => {
  test("profile email is omitted; outsider profile, submission, and late-day reads return NOT_FOUND; staff submission history succeeds", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const send = async (path: string, body: Record<string, unknown>) => {
      const result = await app.invoker.invoke(path, body as never);
      return result.ok
        ? (result.value as Record<string, unknown>)
        : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
    };
    const actor = async (username: string) => {
      const made = await send("/auth/register", {
        username,
        password: "password123",
        email: `${username}@example.edu`,
        displayName: username,
      });
      const login = await send("/auth/login", { username, password: "password123" });
      return { user: made.user as string, session: login.session as string };
    };
    const staff = await actor("mongo_staff");
    const learner = await actor("mongo_learner");
    const outsider = await actor("mongo_outsider");
    const defined = await send("/roles/define", {
      session: staff.session,
      name: "mongo-course-staff",
      capabilities: ["roster:manage", "submissions:view-all", "late-days:manage"],
    });
    await send("/roles/grant", {
      session: staff.session,
      user: staff.user,
      context: "forum",
      role: defined.role,
    });
    await send("/roster/import", {
      session: staff.session,
      rows: [
        {
          externalKey: "mongo-learner",
          email: "mongo_learner@example.edu",
          rosterName: "Learner",
          kind: "STUDENT",
        },
      ],
    });
    await send("/roster/claim-seat", { session: learner.session, externalKey: "mongo-learner" });

    expect(
      await send("/profiles/get", { session: learner.session, user: staff.user }),
    ).not.toHaveProperty("profile.email");
    expect(await send("/profiles/get", { session: outsider.session, user: learner.user })).toEqual({
      error: "NOT_FOUND",
    });
    expect(
      await send("/submissions/for-student", {
        session: outsider.session,
        submitter: learner.user,
      }),
    ).toEqual({ error: "NOT_FOUND" });
    expect(
      await send("/late-days/balance", { session: outsider.session, learner: learner.user }),
    ).toEqual({ error: "NOT_FOUND" });
    expect(
      await send("/submissions/for-student", { session: staff.session, submitter: learner.user }),
    ).toEqual({ submissions: [] });
  });
});

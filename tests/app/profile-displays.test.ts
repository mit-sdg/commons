import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

test("display batches preserve profile access and expose only names and avatars", async () => {
  const db = await testDb();
  try {
    const floor = mongoImplementations(db);
    const readProfiles = floor.Profiling._getProfilesOf.bind(floor.Profiling);
    let profileReads = 0;
    floor.Profiling._getProfilesOf = async (input) => {
      profileReads += 1;
      return readProfiles(input);
    };
    const people = await Promise.all(
      ["member", "outside", "manager"].map(async (username) => {
        const { user } = await floor.Authenticating.register({
          username,
          email: `${username}@example.edu`,
          password: "test-password",
        });
        await floor.Profiling.createProfile({ user, displayName: username });
        await floor.Profiling.setBio({ user, bio: "BIO_NOT_NEEDED_FOR_DISPLAY" });
        const { session } = await floor.Sessioning.start({ user });
        return { user, session, username };
      }),
    );
    const [member, outside, manager] = people;
    await floor.Rostering.enrol({
      user: member.user,
      email: "member@example.edu",
      kind: "STUDENT",
      section: null,
    });
    const { role } = await floor.Roling.defineRole({
      name: "Course manager",
      capabilities: ["course:manage"],
    });
    await floor.Roling.assign({ user: manager.user, context: "commons", role });
    const edge = createEdge(floor, "https://commons.test");
    const app = edge.application;
    const users = [outside.user, member.user, "missing", outside.user];
    const display = (person: (typeof people)[number]) => ({
      user: person.user,
      displayName: person.username,
      avatar: "",
    });
    for (const actor of [member, manager]) {
      expect(
        await app.invoker.invoke("/profiles/displays", { session: actor.session, users }),
      ).toMatchObject({ ok: true, value: { profiles: [display(outside), display(member)] } });
      const result = await app.invoker.invoke("/profiles/displays", {
        session: actor.session,
        users,
      });
      expect(JSON.stringify(result)).not.toContain("BIO_NOT_NEEDED");
      expect(JSON.stringify(result)).not.toContain("@example.edu");
    }
    expect(
      await app.invoker.invoke("/profiles/displays", { session: outside.session, users }),
    ).toMatchObject({ ok: true, value: { profiles: [display(outside)] } });
    expect(
      await app.invoker.invoke("/profiles/displays", {
        session: outside.session,
        users: [member.user, "missing"],
      }),
    ).toMatchObject({ ok: true, value: { profiles: [] } });
    const readsBeforeInvalidInput = profileReads;
    for (const invalid of [
      null,
      {},
      "member",
      [null],
      [""],
      ["x".repeat(257)],
      Array(65).fill("x"),
    ]) {
      expect(
        await app.invoker.invoke("/profiles/displays", {
          session: member.session,
          users: invalid,
        }),
      ).toMatchObject({ ok: false, error: { kind: "domain", value: "INVALID_REQUEST" } });
    }
    const invalidHttp = await edge.fetch(
      new Request("https://commons.test/api/profiles/displays", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://commons.test",
          Cookie: `__Host-commons-session=${member.session}`,
        },
        body: JSON.stringify({ users: Array(65).fill(member.user) }),
      }),
    );
    expect(invalidHttp.status).toBe(400);
    expect(await invalidHttp.json()).toEqual({ error: "INVALID_REQUEST" });
    expect(profileReads).toBe(readsBeforeInvalidInput);
    expect(
      await app.invoker.invoke("/profiles/displays", { session: member.session, users: [] }),
    ).toMatchObject({ ok: true, value: { profiles: [] } });
  } finally {
    await db.dropDatabase();
  }
});

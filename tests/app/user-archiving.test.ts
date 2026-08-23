import { afterAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";

afterAll(stopTestDb);

/** Register an administrator (the first account) and one ordinary member. */
async function forumWithAdminAndMember() {
  const edge = createEdge(mongoImplementations(await testDb()));
  const register = async (username: string, email: string) => {
    const result = await edge.application.concepts.Authenticating.register({
      username,
      password: "password123",
      email,
    });
    if ("error" in result) throw new Error(String(result.error));
    await edge.application.whenIdle();
    return result.user;
  };
  const admin = await register("archive_admin", "archive-admin@example.edu");
  const member = await register("archive_member", "archive-member@example.edu");
  const signIn = async (username: string) =>
    await edge.gateway.invoke("/auth/login", { username, password: "password123" });
  const adminLogin = await signIn("archive_admin");
  if (!adminLogin.ok) throw new Error("the administrator could not sign in");
  const adminSession = (adminLogin.value as { session: string }).session;
  return { edge, admin, member, adminSession, signIn };
}

describe("archiving a user", () => {
  test("an archived account cannot sign in, and restoring it lets the person back", async () => {
    const { edge, member, adminSession, signIn } = await forumWithAdminAndMember();

    expect((await signIn("archive_member")).ok).toBe(true);

    const archived = await edge.gateway.invoke("/users/archive", {
      session: adminSession,
      user: member,
    });
    expect(archived).toMatchObject({ ok: true, value: { user: member } });
    await edge.application.whenIdle();

    expect(await signIn("archive_member")).toMatchObject({
      ok: false,
      error: { kind: "domain", value: "FORBIDDEN" },
    });

    const restored = await edge.gateway.invoke("/users/restore", {
      session: adminSession,
      user: member,
    });
    expect(restored).toMatchObject({ ok: true, value: { user: member } });
    await edge.application.whenIdle();

    expect((await signIn("archive_member")).ok).toBe(true);
  });

  test("archiving ends every session the account already holds", async () => {
    const { edge, member, adminSession } = await forumWithAdminAndMember();

    // Drive this one over HTTP so the session cookie is exercised the way a
    // browser holds it.
    const login = await edge.fetch(
      new Request("http://edge/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "archive_member", password: "password123" }),
      }),
    );
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;
    expect(cookie).toBeTruthy();

    const readWithCookie = async () =>
      await edge.fetch(
        new Request("http://edge/api/threads/latest", {
          method: "POST",
          headers: { "content-type": "application/json", Cookie: cookie },
          body: "{}",
        }),
      );
    expect((await readWithCookie()).status).toBe(200);

    await edge.gateway.invoke("/users/archive", { session: adminSession, user: member });
    await edge.application.whenIdle();

    const after = await readWithCookie();
    expect(after.status).toBe(401);
    expect(await after.json()).toEqual({ error: "UNAUTHORIZED" });
  });

  test("a wrong password on an archived account is still just bad credentials", async () => {
    const { edge, member, adminSession } = await forumWithAdminAndMember();
    await edge.gateway.invoke("/users/archive", { session: adminSession, user: member });
    await edge.application.whenIdle();

    // Archiving must not become an oracle for which accounts exist.
    expect(
      await edge.gateway.invoke("/auth/login", {
        username: "archive_member",
        password: "the-wrong-password",
      }),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "INVALID_CREDENTIALS" } });
  });

  test("the users list reports who is archived", async () => {
    const { edge, member, adminSession } = await forumWithAdminAndMember();
    await edge.gateway.invoke("/users/archive", { session: adminSession, user: member });
    await edge.application.whenIdle();

    const listed = await edge.gateway.invoke("/users/list", { session: adminSession });
    if (!listed.ok) throw new Error("the administrator could not list users");
    const users = (listed.value as { users: { user: string; archived: boolean }[] }).users;
    expect(users.find((row) => row.user === member)?.archived).toBe(true);
    expect(users.filter((row) => row.user !== member).every((row) => !row.archived)).toBe(true);
  });

  test("a non-administrator cannot archive, and an administrator cannot archive themselves", async () => {
    const { edge, admin, member, adminSession, signIn } = await forumWithAdminAndMember();

    const memberLogin = await signIn("archive_member");
    if (!memberLogin.ok) throw new Error("the member could not sign in");
    const memberSession = (memberLogin.value as { session: string }).session;

    expect(
      await edge.gateway.invoke("/users/archive", { session: memberSession, user: admin }),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "FORBIDDEN" } });

    expect(
      await edge.gateway.invoke("/users/archive", { session: adminSession, user: admin }),
    ).toMatchObject({ ok: false, error: { kind: "domain", value: "FORBIDDEN" } });
    await edge.application.whenIdle();

    // The administrator is still able to sign in and still able to archive others.
    expect((await signIn("archive_admin")).ok).toBe(true);
    expect(
      (await edge.gateway.invoke("/users/archive", { session: adminSession, user: member })).ok,
    ).toBe(true);
  });
});

import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/vocabulary.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { assembleCommons } from "../../src/assembly/application.ts";

afterAll(stopTestDb);

async function mongoApp() {
  const app = assembleCommons(mongoImplementations(await testDb()));
  const send = async (path: string, body: Record<string, unknown>) => {
    const result = await app.invoker.invoke(path, body as never);
    return result.ok
      ? (result.value as Record<string, unknown>)
      : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
  };
  const signUp = async (username: string, email = `${username}@example.com`) => {
    const registered = await app.concepts.Authenticating.register({
      username,
      password: "password123",
      email,
    });
    await app.concepts.Profiling.createProfile({
      user: registered.user,
      displayName: username,
      email,
    });
    const { session } = (await send("/auth/login", {
      username,
      password: "password123",
    })) as { session: string };
    return session;
  };
  return { send, signUp };
}

describe("Commons with every concept on MongoDB", () => {
  test("a thread renders, notifies a mention, refuses a locked reply, and appears in the feed", async () => {
    const { send, signUp } = await mongoApp();
    const mod = await signUp("mod");
    const mara = await signUp("mara");

    const thread = await send("/threads/create", {
      session: mod,
      content: "# Welcome\nSay hi to @mara",
    });
    expect(thread.conversation).toBeDefined();

    const got = (await send("/threads/get", { conversation: thread.conversation })) as {
      thread: { rendered: string }[];
    };
    expect(got.thread[0].rendered).toContain("<h1>");
    expect(got.thread[0].rendered).toContain('<a href="/u/mara">@mara</a>');

    const inbox = (await send("/notifications/list", { session: mara })) as {
      notifications: { kind: string }[];
    };
    expect(inbox.notifications.some((n) => n.kind === "mention")).toBe(true);

    const locked = await send("/locks/lock", { session: mod, target: thread.conversation });
    expect(locked.error).toBeUndefined();
    expect(
      await send("/threads/reply", { session: mara, parent: thread.node, content: "hi!" }),
    ).toEqual({ error: "FORBIDDEN" });

    const feed = (await send("/threads/activity", {})) as {
      conversations: { conversation: string }[];
    };
    expect(feed.conversations).toHaveLength(1);
    expect(feed.conversations[0].conversation).toBe(thread.conversation);
  });

  test("a course-staff role authorizes roster, assignment, and submission endpoints", async () => {
    const { send, signUp } = await mongoApp();
    const staff = await signUp("staff");

    const { user } = (await send("/auth/me", { session: staff })) as { user: string };
    const { role } = (await send("/roles/define", {
      session: staff,
      name: "course-staff",
      capabilities: ["roster:manage", "assignments:manage"],
    })) as { role: string };
    const granted = await send("/roles/grant", { session: staff, user, context: "forum", role });
    expect(granted.error).toBeUndefined();

    const imported = await send("/roster/import", {
      session: staff,
      rows: [{ externalKey: "s-1", email: "s1@x.com", rosterName: "Student One", kind: "STUDENT" }],
    });
    expect(imported.error).toBeUndefined();

    const student = await signUp("student1", "s1@x.com");
    const claim = await send("/roster/claim-seat", { session: student, externalKey: "s-1" });
    expect(claim.error).toBeUndefined();
    expect(await send("/assignments/staff-list", { session: student })).toEqual({
      error: "FORBIDDEN",
    });

    const draft = (await send("/assignments/create-draft", {
      session: staff,
      title: "HW1",
      instructions: "Do the reading",
      kind: "HOMEWORK",
      availableAt: new Date().toISOString(),
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      audience: "EVERYONE",
      acceptsSubmissions: true,
    })) as { assignment: string };
    expect(draft.assignment).toBeDefined();

    const staffList = (await send("/assignments/staff-list", { session: staff })) as {
      assignments: { assignment: string; title: string; status: string }[];
    };
    expect(staffList.assignments).toEqual([
      expect.objectContaining({ assignment: draft.assignment, title: "HW1", status: "DRAFT" }),
    ]);

    expect(
      await send("/calendar/staff", {
        session: staff,
        start: "2026-01-01T00:00:00.000Z",
        end: "2027-01-01T00:00:00.000Z",
      }),
    ).toEqual({ events: [] });

    const published = await send("/assignments/publish", {
      session: staff,
      assignment: draft.assignment,
    });
    expect(published.error).toBeUndefined();

    const submitted = await send("/assignments/submit", {
      session: student,
      assignment: draft.assignment,
      content: "my answer",
    });
    expect(submitted.error).toBeUndefined();

    const mine = (await send("/assignments/for-me", { session: student })) as {
      assignments: { assignment: string }[];
    };
    expect(mine.assignments.some((a) => a.assignment === draft.assignment)).toBe(true);
  });
});

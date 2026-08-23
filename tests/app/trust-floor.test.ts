import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, beforeEach, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import { createEdge } from "../../src/edge.ts";

type Actor = { user: string; cookie: string; email: string };

describe("HTTP authorization and privacy", () => {
  let edge: ReturnType<typeof createEdge>;
  const call = async (path: string, body: Record<string, unknown>, cookie?: string) => {
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
  const register = async (username: string): Promise<Actor> => {
    const email = `${username}@example.edu`;
    const made = await edge.application.concepts.Authenticating.register({
      username,
      password: "password123",
      email,
    });
    await edge.application.concepts.Profiling.createProfile({
      user: made.user,
      displayName: username,
      email,
    });
    const login = await call("/auth/login", { username, password: "password123" });
    return { user: made.user, cookie: login.cookie as string, email };
  };

  let admin: Actor;
  let learner: Actor;
  let limitedStaff: Actor;
  let outsider: Actor;
  beforeEach(async () => {
    edge = createEdge(mongoImplementations(await testDb()));
    admin = await register("admin");
    learner = await register("learner");
    limitedStaff = await register("limited_staff");
    outsider = await register("outsider");
    // The administrator already reaches every capability through the wildcard,
    // so no staff role has to be assigned to them.
    await call(
      "/roster/import",
      {
        rows: [
          { email: learner.email, kind: "STUDENT", section: "A" },
          { email: limitedStaff.email, kind: "STUDENT", section: "A" },
        ],
      },
      admin.cookie,
    );
    await call(
      "/roster/enroll",
      { email: learner.email, kind: "STUDENT", section: "A", user: learner.user },
      admin.cookie,
    );
    await call(
      "/roster/enroll",
      {
        email: limitedStaff.email,
        kind: "STUDENT",
        section: "A",
        user: limitedStaff.user,
      },
      admin.cookie,
    );
    const limitedRole = await call(
      "/roles/define",
      { name: "limited-staff", capabilities: ["moderate"] },
      admin.cookie,
    );
    await call(
      "/roles/assign",
      { user: limitedStaff.user, context: "forum", role: limitedRole.body.role },
      admin.cookie,
    );
  });

  test("the last administrator cannot be removed and nobody can promote themselves", async () => {
    // Removing the only administrator used to leave policy open to everyone.
    const revoked = await call(
      "/roles/revoke",
      { user: admin.user, context: "forum" },
      admin.cookie,
    );
    expect(revoked).toMatchObject({ status: 409, body: { error: "CONFLICT" } });

    const lesser = await call(
      "/roles/define",
      { name: "lesser", capabilities: ["moderate"] },
      admin.cookie,
    );
    expect(lesser.status).toBe(200);
    const moved = await call(
      "/roles/assign",
      { user: admin.user, context: "forum", role: lesser.body.role },
      admin.cookie,
    );
    expect(moved).toMatchObject({ status: 409, body: { error: "CONFLICT" } });

    // The administrator still administers, and an ordinary account still cannot.
    expect((await call("/auth/permissions", {}, admin.cookie)).body).toMatchObject({
      capabilities: expect.arrayContaining(["administer"]),
    });
    expect(
      await call(
        "/roles/define",
        { name: "takeover", capabilities: ["administer"] },
        outsider.cookie,
      ),
    ).toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
    expect(
      await call("/invitations/invite", { email: "x@example.edu" }, outsider.cookie),
    ).toMatchObject({ status: 403, body: { error: "FORBIDDEN" } });
  });

  test("archiving an account that holds a role revokes it first, then archives, then ends its sessions", async () => {
    expect(
      (await call("/roles/forUser", { user: limitedStaff.user, context: "forum" }, admin.cookie))
        .body,
    ).toMatchObject({ name: "limited-staff" });

    const before = inspectAssembly(edge.application).occurrences.length;
    const archived = await call("/users/archive", { user: limitedStaff.user }, admin.cookie);
    expect(archived).toMatchObject({ status: 200, body: { user: limitedStaff.user } });
    await edge.application.whenIdle();

    // The order matters: an account that is already archived must never be seen
    // holding a role, so the revocation lands before the archive commits.
    const steps = inspectAssembly(edge.application)
      .occurrences.slice(before)
      .map((event) => `${event.concept}.${event.action}`);
    expect(steps).toContain("Roling.revoke");
    expect(steps.indexOf("Roling.revoke")).toBeLessThan(steps.indexOf("Archiving.trash"));
    expect(steps.indexOf("Archiving.trash")).toBeLessThan(
      steps.indexOf("Sessioning.endAllForUser"),
    );

    expect(
      (await call("/roles/forUser", { user: limitedStaff.user, context: "forum" }, admin.cookie))
        .body,
    ).toMatchObject({ role: null, name: null, capabilities: [] });
    const listed = await call("/users/list", {}, admin.cookie);
    expect(
      (listed.body.users as { user: string; archived: boolean; role: unknown }[]).find(
        (row) => row.user === limitedStaff.user,
      ),
    ).toMatchObject({ archived: true, role: { role: null, name: null, capabilities: null } });
    expect((await call("/auth/me", {}, limitedStaff.cookie)).status).toBe(401);
  });

  test("archiving an account that holds no role archives it without surfacing a refusal", async () => {
    expect(
      (await call("/roles/forUser", { user: learner.user, context: "forum" }, admin.cookie)).body,
    ).toMatchObject({ role: null });

    const archived = await call("/users/archive", { user: learner.user }, admin.cookie);
    expect(archived).toEqual({
      status: 200,
      body: { user: learner.user },
      cookie: undefined,
    });
    await edge.application.whenIdle();

    const listed = await call("/users/list", {}, admin.cookie);
    expect(
      (listed.body.users as { user: string; archived: boolean }[]).find(
        (row) => row.user === learner.user,
      ),
    ).toMatchObject({ archived: true });
    expect((await call("/auth/me", {}, learner.cookie)).status).toBe(401);
  });

  test("archiving the other administrator leaves the last live one unable to give up administer", async () => {
    // A second administrator holds the built-in role established at registration.
    expect(
      await call(
        "/roles/assign",
        { user: outsider.user, context: "forum", role: "administrator" },
        admin.cookie,
      ),
    ).toMatchObject({ status: 200 });
    expect((await call("/auth/permissions", {}, outsider.cookie)).body).toMatchObject({
      capabilities: expect.arrayContaining(["administer"]),
    });

    expect(await call("/users/archive", { user: outsider.user }, admin.cookie)).toMatchObject({
      status: 200,
      body: { user: outsider.user },
    });
    await edge.application.whenIdle();

    // The archived account can never sign in again, so it no longer counts as a
    // holder: the guard now sees exactly one administrator, the live one.
    expect(
      await call("/roles/revoke", { user: admin.user, context: "forum" }, admin.cookie),
    ).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    const lesser = await call(
      "/roles/define",
      { name: "lesser", capabilities: ["moderate"] },
      admin.cookie,
    );
    expect(
      await call(
        "/roles/assign",
        { user: admin.user, context: "forum", role: lesser.body.role },
        admin.cookie,
      ),
    ).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
    expect((await call("/auth/permissions", {}, admin.cookie)).body).toMatchObject({
      capabilities: expect.arrayContaining(["administer"]),
    });
  });

  test("role refusals reach the client as public categories, not as server errors", async () => {
    const typo = await call(
      "/roles/define",
      { name: "typo-role", capabilities: ["gradez:manag"] },
      admin.cookie,
    );
    expect(typo).toMatchObject({
      status: 400,
      body: { error: "INVALID_REQUEST" },
    });

    const held = await call("/roles/delete", { role: "limited-staff" }, admin.cookie);
    expect(held).toMatchObject({ status: 409, body: { error: "CONFLICT" } });
  });

  test("/profiles/get returns email to an authenticated owner or course:manage reader, public fields to an active member, 401 anonymously, and 404 otherwise", async () => {
    const own = await call("/profiles/get", { user: learner.user }, learner.cookie);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ profile: { email: learner.email } });
    const unrosteredOwn = await call("/profiles/get", { user: outsider.user }, outsider.cookie);
    expect(unrosteredOwn.status).toBe(200);
    expect(unrosteredOwn.body).toMatchObject({ profile: { email: outsider.email } });
    const member = await call("/profiles/get", { user: admin.user }, learner.cookie);
    expect(member.status).toBe(200);
    expect(member.body.profile).not.toHaveProperty("email");
    expect(
      await call("/profiles/get", { user: crypto.randomUUID() }, learner.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    const staff = await call("/profiles/get", { user: learner.user }, admin.cookie);
    expect(staff.body).toMatchObject({ profile: { email: learner.email } });
    const hidden = await call("/profiles/get", { user: learner.user }, outsider.cookie);
    expect(hidden).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    const limited = await call("/profiles/get", { user: learner.user }, limitedStaff.cookie);
    expect(limited.status).toBe(200);
    expect(limited.body.profile).not.toHaveProperty("email");
    expect(await call("/profiles/get", { user: learner.user })).toMatchObject({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
  });

  test("submission and balance routes allow the owner or grade/student-records staff; other known users and unknown learners receive 404", async () => {
    const submissionReads = [
      ["/submissions/for-student", { submitter: learner.user }],
      ["/submissions/latest", { submitter: learner.user, assignment: "work" }],
      ["/submissions/attempts", { submitter: learner.user, assignment: "work" }],
    ] as const;
    for (const [path, body] of submissionReads) {
      expect((await call(path, body, learner.cookie)).status).toBe(200);
      expect(await call(path, body, outsider.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
      expect(await call(path, body, limitedStaff.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
      expect((await call(path, body, admin.cookie)).status).toBe(200);
      expect(await call(path, body)).toMatchObject({
        status: 401,
        body: { error: "UNAUTHORIZED" },
      });
      expect(
        await call(path, { ...body, submitter: crypto.randomUUID() }, admin.cookie),
      ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    }
    expect(
      (await call("/late-days/balance", { learner: learner.user }, learner.cookie)).status,
    ).toBe(200);
    expect(
      await call("/late-days/balance", { learner: learner.user }, outsider.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect((await call("/late-days/balance", { learner: learner.user }, admin.cookie)).status).toBe(
      200,
    );
    expect(
      await call("/late-days/balance", { learner: learner.user }, limitedStaff.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await call("/late-days/balance", { learner: learner.user })).toMatchObject({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });
    expect(
      await call("/late-days/balance", { learner: crypto.randomUUID() }, admin.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(
      await call(
        "/late-days/staff-change",
        { learner: learner.user, assignment: "work", days: 1 },
        outsider.cookie,
      ),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
  });

  test("active owners may change and cancel late-day use; inactive users receive 403; student-records staff may use staff routes; other and unknown learners receive 404", async () => {
    expect(
      (
        await call(
          "/late-days/configure-policy",
          { defaultDays: 5, unitHours: 24, maxDaysPerItem: 3 },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await call("/late-days/apply", { assignment: "work", days: 1 }, learner.cookie)).status,
    ).toBe(200);
    expect(
      (await call("/late-days/change", { assignment: "work", days: 2 }, learner.cookie)).status,
    ).toBe(200);
    expect((await call("/late-days/cancel", { assignment: "work" }, learner.cookie)).status).toBe(
      200,
    );

    for (const path of ["/late-days/change", "/late-days/cancel"] as const) {
      const body = path.endsWith("change")
        ? { assignment: "work", days: 1 }
        : { assignment: "work" };
      expect(await call(path, body, outsider.cookie)).toMatchObject({
        status: 403,
        body: { error: "FORBIDDEN" },
      });
      expect(await call(path, body)).toMatchObject({
        status: 401,
        body: { error: "UNAUTHORIZED" },
      });
    }

    await call("/late-days/apply", { assignment: "staff-work", days: 1 }, learner.cookie);
    expect(
      await call(
        "/late-days/staff-change",
        { learner: learner.user, assignment: "staff-work", days: 2 },
        limitedStaff.cookie,
      ),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(
      (
        await call(
          "/late-days/staff-change",
          { learner: learner.user, assignment: "staff-work", days: 2 },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/late-days/staff-cancel",
          { learner: learner.user, assignment: "staff-work" },
          admin.cookie,
        )
      ).status,
    ).toBe(200);
    for (const path of ["/late-days/staff-change", "/late-days/staff-cancel"] as const) {
      const body = {
        learner: crypto.randomUUID(),
        assignment: "staff-work",
        ...(path.endsWith("change") ? { days: 1 } : {}),
      };
      expect(await call(path, body, admin.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    }
  });

  test("revision routes require a member session and hide trashed items while moderate readers may use moderation routes", async () => {
    const thread = await call("/threads/create", { content: "private after trash" }, admin.cookie);
    const item = thread.body.post as string;
    for (const [path, body] of [
      ["/revisions/list", { item }],
      ["/revisions/get", { item, number: 1 }],
      ["/revisions/latest", { item }],
    ] as const)
      expect((await call(path, body, learner.cookie)).status).toBe(200);
    await call("/trash/trash", { item }, admin.cookie);
    for (const [publicPath, moderationPath, body] of [
      ["/revisions/list", "/moderation/revisions/list", { item }],
      ["/revisions/get", "/moderation/revisions/get", { item, number: 1 }],
      ["/revisions/latest", "/moderation/revisions/latest", { item }],
    ] as const) {
      const unknownBody = { ...body, item: crypto.randomUUID() };
      const hidden = await call(publicPath, body, learner.cookie);
      expect(hidden).toEqual(await call(publicPath, unknownBody, learner.cookie));
      expect(hidden).toEqual({ status: 404, body: { error: "NOT_FOUND" }, cookie: undefined });
      expect((await call(moderationPath, body, admin.cookie)).status).toBe(200);
      expect(await call(moderationPath, body, outsider.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
      expect(await call(moderationPath, unknownBody, admin.cookie)).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    }
    expect((await call("/moderation/posts/get", { item }, admin.cookie)).status).toBe(200);
    expect(await call("/moderation/posts/get", { item }, outsider.cookie)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  });

  test("a learner receives 404 for staff-only and unknown notes while student-records staff may read the staff-only note", async () => {
    const written = await call(
      "/students/notes/write",
      {
        learner: learner.user,
        body: "staff confidence",
        visibility: "STAFF_ONLY",
        tags: [],
        followUpAt: null,
      },
      admin.cookie,
    );
    const hidden = await call(
      "/students/notes/acknowledge",
      { note: written.body.note },
      learner.cookie,
    );
    const missing = await call(
      "/students/notes/acknowledge",
      { note: crypto.randomUUID() },
      learner.cookie,
    );
    expect(hidden).toEqual(missing);
    expect(hidden).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    const staffRead = await call("/students/notes/list", { learner: learner.user }, admin.cookie);
    expect(staffRead.status).toBe(200);
    expect(staffRead.body.notes).toEqual(
      expect.arrayContaining([expect.objectContaining({ note: written.body.note })]),
    );
  });

  test("target reads and mutations return the same 404 shapes for trashed, purged, and unknown posts except /threads/forItem, which returns its documented null shape", async () => {
    const made = await call("/threads/create", { content: "satellite target" }, admin.cookie);
    const item = made.body.post as string;
    const conversation = made.body.conversation as string;
    await call(
      "/threads/reply",
      { parent: made.body.node as string, content: "keeps the root node nonleaf" },
      learner.cookie,
    );
    const category = await call(
      "/categories/create",
      { name: "Trust", description: "Trust probes" },
      admin.cookie,
    );
    const tag = await call("/tags/create", { name: "trust" }, admin.cookie);
    const unknown = crypto.randomUUID();
    const unknownConversation = crypto.randomUUID();

    const probes = [
      ["/categories/forItem", (post: string) => ({ item: post })],
      ["/tags/forTarget", (post: string) => ({ target: post })],
      ["/reactions/forTarget", (post: string) => ({ target: post })],
      ["/links/backlinks", (post: string) => ({ target: post })],
      ["/links/forward", (post: string) => ({ source: post })],
      ["/pins/isPinned", (post: string) => ({ item: post, scope: "forum" })],
      ["/resolutions/get", (post: string) => ({ question: post })],
      ["/resolutions/isResolved", (post: string) => ({ question: post })],
      ["/threads/forItem", (post: string) => ({ item: post })],
      ["/locks/isLocked", (post: string) => ({ target: post })],
      ["/bookmarks/isSaved", (post: string) => ({ item: post }), outsider.cookie],
      ["/flags/forTarget", (post: string) => ({ target: post }), admin.cookie],
    ] as const;
    const conversationProbes = [
      ["/subscriptions/isSubscribed", (target: string) => ({ target }), outsider.cookie],
      ["/subscriptions/subscribers", (target: string) => ({ target })],
    ] as const;

    for (const [path, bodyOf, cookie] of probes) {
      expect((await call(path, bodyOf(item), cookie ?? learner.cookie)).status, path).toBe(200);
    }
    for (const [path, bodyOf, cookie] of conversationProbes) {
      expect((await call(path, bodyOf(conversation), cookie ?? learner.cookie)).status, path).toBe(
        200,
      );
    }
    expect((await call("/flags/open", {}, admin.cookie)).status).toBe(200);
    expect(await call("/flags/open", {}, outsider.cookie)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await call("/flags/open", {})).toMatchObject({
      status: 401,
      body: { error: "UNAUTHORIZED" },
    });

    expect((await call("/trash/trash", { item }, admin.cookie)).status).toBe(200);
    for (const [path, bodyOf, cookie] of probes) {
      expect(await call(path, bodyOf(item), cookie), `${path} trashed`).toEqual(
        await call(path, bodyOf(unknown), cookie),
      );
    }
    for (const [path, bodyOf, cookie] of conversationProbes) {
      expect(await call(path, bodyOf(conversation), cookie), `${path} trashed`).toEqual(
        await call(path, bodyOf(unknownConversation), cookie),
      );
    }
    const hiddenMutations = [
      ["/categories/assign", { item, category: category.body.category }, admin.cookie],
      ["/categories/unassign", { item }, admin.cookie],
      ["/tags/add", { target: item, tag: tag.body.tag }, learner.cookie],
      ["/tags/remove", { target: item, tag: tag.body.tag }, learner.cookie],
      ["/reactions/add", { target: item, kind: "like" }, learner.cookie],
      ["/reactions/remove", { target: item, kind: "like" }, learner.cookie],
      ["/pins/pin", { item, scope: "forum", priority: 1 }, admin.cookie],
      ["/pins/unpin", { item, scope: "forum" }, admin.cookie],
      ["/pins/setPriority", { item, scope: "forum", priority: 2 }, admin.cookie],
      ["/flags/raise", { target: item, reason: "hidden" }, learner.cookie],
      ["/flags/resolve", { target: item, outcome: "dismissed" }, admin.cookie],
      ["/bookmarks/save", { item }, learner.cookie],
      ["/bookmarks/unsave", { item }, learner.cookie],
      ["/subscriptions/subscribe", { target: conversation }, learner.cookie],
      ["/subscriptions/unsubscribe", { target: conversation }, learner.cookie],
    ] as const;
    for (const [path, body, cookie] of hiddenMutations) {
      expect(await call(path, body, cookie), `${path} mutation`).toMatchObject({
        status: 404,
        body: { error: "NOT_FOUND" },
      });
    }
    expect(
      await call("/posts/edit", { post: item, content: "bypass" }, admin.cookie),
    ).toMatchObject({ status: 404, body: { error: "NOT_FOUND" } });
    expect(await call("/posts/delete", { post: item }, admin.cookie)).toMatchObject({
      status: 404,
      body: { error: "NOT_FOUND" },
    });

    expect((await call("/trash/purge", { item }, admin.cookie)).status).toBe(200);
    for (const [path, bodyOf, cookie] of probes) {
      expect(await call(path, bodyOf(item), cookie), `${path} purged`).toEqual(
        await call(path, bodyOf(unknown), cookie),
      );
    }
    expect(await call("/threads/forItem", { item })).toEqual(
      await call("/threads/forItem", { item: unknown }),
    );
    expect(await call("/moderation/posts/get", { item }, admin.cookie)).toEqual(
      await call("/moderation/posts/get", { item: unknown }, admin.cookie),
    );
    expect(await call("/moderation/revisions/list", { item }, admin.cookie)).toEqual(
      await call("/moderation/revisions/list", { item: unknown }, admin.cookie),
    );
  });
});

test("the HTTP edge rejects and clears a cookie at the server-side expiry boundary", async () => {
  const startedAt = Date.now() + 60_000;
  let now = new Date(startedAt);
  const edge = createEdge(
    mongoImplementations(await testDb(), () => now),
    undefined,
    () => now,
  );
  const post = async (path: string, body: Record<string, unknown>, cookie?: string) => {
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
    return response;
  };
  const expiring = await edge.application.concepts.Authenticating.register({
    username: "expiring",
    password: "password123",
    email: "expiring@example.edu",
  });
  await edge.application.concepts.Profiling.createProfile({
    user: expiring.user,
    displayName: "Expiring",
    email: "expiring@example.edu",
  });
  const login = await post("/auth/login", { username: "expiring", password: "password123" });
  const cookie = login.headers.get("set-cookie")?.split(";")[0] as string;
  now = new Date(startedAt + 24 * 60 * 60 * 1_000 - 1);
  expect((await post("/auth/me", {}, cookie)).status).toBe(200);
  now = new Date(startedAt + 24 * 60 * 60 * 1_000);
  const expired = await post("/auth/me", {}, cookie);
  expect(expired.status).toBe(401);
  expect(await expired.json()).toEqual({ error: "UNAUTHORIZED" });
  expect(expired.headers.get("set-cookie")).toContain("Max-Age=0");
  const replay = await post("/auth/me", {}, cookie);
  expect(replay.status).toBe(401);
  expect(await replay.json()).toEqual({ error: "UNAUTHORIZED" });
});

test("dropping the actor's own staff seat returns one response and keeps their capability", async () => {
  const app = assembleCommons(mongoImplementations(await testDb()));
  const send = async (path: string, body: Record<string, unknown>) => {
    const result = await app.invoker.invoke(path, body as never);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    return result.ok ? (result.value as Record<string, unknown>) : {};
  };
  const actor = async (username: string) => {
    const email = `${username}@example.edu`;
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
    const login = await send("/auth/login", { username, password: "password123" });
    return { user: registered.user, session: login.session as string };
  };

  const admin = await actor("roster_admin");
  const staff = await actor("departing_staff");
  const { role: courseManager } = await app.concepts.Roling.ensureRole({
    name: "course-manager-test",
    capabilities: ["course:manage"],
  });
  await app.concepts.Roling.assign({
    user: admin.user,
    context: "forum",
    role: courseManager,
  });
  await app.concepts.Roling.assign({
    user: staff.user,
    context: "forum",
    role: courseManager,
  });
  await send("/roster/import", {
    session: admin.session,
    rows: [{ email: "departing_staff@example.edu", kind: "STAFF" }],
  });
  const [pending] = await app.concepts.Rostering._getPendingSeatByEmail({
    email: "departing_staff@example.edu",
  });
  const claimed = await app.concepts.Rostering.claimSeat({
    seat: pending.seat,
    user: staff.user,
  });
  const seat = claimed.seat._id;
  expect(await app.concepts.Rostering._getSeatByUser({ user: staff.user })).toEqual([
    expect.objectContaining({ seat, status: "ACTIVE" }),
  ]);

  const before = inspectAssembly(app).occurrences.length;
  expect(await send("/roster/drop", { session: staff.session, seat })).toEqual({
    seat: expect.objectContaining({ _id: seat, status: "DROPPED" }),
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  const responses = inspectAssembly(app)
    .occurrences.slice(before)
    .filter((event) => event.concept === "RequestBoundary" && event.action === "respond");
  expect(responses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
  expect(responses.filter((event) => event.outcome?.kind === "error")).toHaveLength(0);

  // Enrolment and authority are separate now, so losing the seat does not
  // silently strip the capability that authorised the request.
  expect(
    await app.concepts.Roling._hasCapability({
      user: staff.user,
      context: "forum",
      capability: "course:manage",
    }),
  ).toEqual({ allowed: true });
});

afterAll(stopTestDb);

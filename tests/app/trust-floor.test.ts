import { beforeEach, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import { createEdge } from "../../src/edge.ts";
import { TimingConcept } from "../../src/concepts/timing/timing.ts";

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
    const made = await call("/auth/register", {
      username,
      password: "password123",
      email,
      displayName: username,
    });
    const login = await call("/auth/login", { username, password: "password123" });
    return { user: made.body.user as string, cookie: login.cookie as string, email };
  };

  let admin: Actor;
  let learner: Actor;
  let limitedStaff: Actor;
  let outsider: Actor;
  beforeEach(async () => {
    edge = createEdge();
    admin = await register("admin");
    learner = await register("learner");
    limitedStaff = await register("limited_staff");
    outsider = await register("outsider");
    const defined = await call(
      "/roles/define",
      {
        name: "course-staff",
        capabilities: [
          "roster:manage",
          "submissions:view-all",
          "late-days:manage",
          "student-notes:manage",
        ],
      },
      admin.cookie,
    );
    await call(
      "/roles/grant",
      { user: admin.user, context: "forum", role: defined.body.role },
      admin.cookie,
    );
    await call(
      "/roster/import",
      {
        rows: [
          {
            externalKey: "learner",
            email: learner.email,
            rosterName: "Learner",
            kind: "STUDENT",
            section: "A",
          },
          {
            externalKey: "limited-staff",
            email: limitedStaff.email,
            rosterName: "Limited Staff",
            kind: "STUDENT",
            section: "A",
          },
        ],
      },
      admin.cookie,
    );
    await call("/roster/claim-seat", { externalKey: "learner" }, learner.cookie);
    await call("/roster/claim-seat", { externalKey: "limited-staff" }, limitedStaff.cookie);
    const limitedRole = await call(
      "/roles/define",
      { name: "limited-staff", capabilities: ["calendar:view-staff"] },
      admin.cookie,
    );
    await call(
      "/roles/grant",
      { user: limitedStaff.user, context: "forum", role: limitedRole.body.role },
      admin.cookie,
    );
  });

  test("/profiles/get returns email to an active owner or roster:manage reader, public fields to an active member, 401 anonymously, and 404 otherwise", async () => {
    const own = await call("/profiles/get", { user: learner.user }, learner.cookie);
    expect(own.status).toBe(200);
    expect(own.body).toMatchObject({ profile: { email: learner.email } });
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

  test("submission routes allow the owner or submissions:view-all and balance allows the owner or late-days:manage; other known users and unknown learners receive 404", async () => {
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

  test("active owners may change and cancel late-day use; inactive users receive 403; late-days:manage staff may use staff routes; other and unknown learners receive 404", async () => {
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

  test("public revision routes return 404 for trashed items while moderate readers may use moderation routes", async () => {
    const thread = await call("/threads/create", { content: "private after trash" }, admin.cookie);
    const item = thread.body.post as string;
    for (const [path, body] of [
      ["/revisions/list", { item }],
      ["/revisions/get", { item, number: 1 }],
      ["/revisions/latest", { item }],
    ] as const)
      expect((await call(path, body)).status).toBe(200);
    await call("/trash/trash", { item }, admin.cookie);
    for (const [publicPath, moderationPath, body] of [
      ["/revisions/list", "/moderation/revisions/list", { item }],
      ["/revisions/get", "/moderation/revisions/get", { item, number: 1 }],
      ["/revisions/latest", "/moderation/revisions/latest", { item }],
    ] as const) {
      const unknownBody = { ...body, item: crypto.randomUUID() };
      const hidden = await call(publicPath, body);
      expect(hidden).toEqual(await call(publicPath, unknownBody));
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

  test("a learner receives 404 for staff-only and unknown notes while student-notes:manage staff may read the staff-only note", async () => {
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
      expect((await call(path, bodyOf(item), cookie)).status, path).toBe(200);
    }
    for (const [path, bodyOf, cookie] of conversationProbes) {
      expect((await call(path, bodyOf(conversation), cookie)).status, path).toBe(200);
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
  const edge = createEdge({ Timing: new TimingConcept(() => now) });
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
  await post("/auth/register", {
    username: "expiring",
    password: "password123",
    email: "expiring@example.edu",
    displayName: "Expiring",
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

test("dropping the actor's staff seat returns one response before roster:manage is revoked", async () => {
  const app = assembleCommons();
  const send = async (path: string, body: Record<string, unknown>) => {
    const result = await app.invoker.invoke(path, body as never);
    expect(result.ok, JSON.stringify(result)).toBe(true);
    return result.ok ? (result.value as Record<string, unknown>) : {};
  };
  const actor = async (username: string) => {
    const registered = await send("/auth/register", {
      username,
      password: "password123",
      email: `${username}@example.edu`,
      displayName: username,
    });
    const login = await send("/auth/login", { username, password: "password123" });
    return { user: registered.user as string, session: login.session as string };
  };

  const admin = await actor("roster_admin");
  const staff = await actor("departing_staff");
  const { role: rosterManager } = await app.concepts.Roling.ensureRole({
    name: "roster-manager-test",
    capabilities: ["roster:manage"],
  });
  await app.concepts.Roling.grant({
    user: admin.user,
    context: "forum",
    role: rosterManager,
  });
  await send("/roster/import", {
    session: admin.session,
    rows: [
      {
        externalKey: "departing-staff",
        email: "departing_staff@example.edu",
        rosterName: "Departing Staff",
        kind: "STAFF",
      },
    ],
  });
  const claimed = await send("/roster/claim-seat", {
    session: staff.session,
    externalKey: "departing-staff",
  });
  expect(claimed).toHaveProperty("seat");
  const seat = (claimed.seat as { _id: string })._id;
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
});

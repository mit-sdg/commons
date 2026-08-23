import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import { theStaffDashboardCounts } from "../../src/compositions/course/calendar.ts";
import { theHomeFeedByCreation, theThreadContext } from "../../src/compositions/forum/feed.ts";
import { theThread } from "../../src/compositions/forum/threads.ts";

async function actor(
  app: ReturnType<typeof assembleCommons>,
  username: string,
  email = `${username}@example.edu`,
) {
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
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!login.ok) throw new Error(`could not create ${username}`);
  return {
    user: registered.user,
    session: (login.value as { session: string }).session,
  };
}

describe("course staff composition", () => {
  test("a claimed staff seat confers no capability of its own", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    // The first account registered becomes the bootstrap administrator, so the
    // staff account under test must not be it.
    await actor(app, "bootstrap_admin");
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [{ email: "one@example.edu", kind: "STAFF" }],
    });
    expect(created).toHaveLength(1);

    const staff = await actor(app, "staff_one", "one@example.edu");
    await app.concepts.Rostering.claimSeat({ seat: created[0]._id, user: staff.user });

    expect(await app.concepts.Roling._getRole({ user: staff.user, context: "forum" })).toEqual([]);
    expect(
      await app.concepts.Roling._hasCapability({
        user: staff.user,
        context: "forum",
        capability: "course:manage",
      }),
    ).toEqual({ allowed: false });
  });

  test("an assigned role is what confers capability, and dropping a seat leaves it alone", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    await actor(app, "bootstrap_admin");
    const staff = await actor(app, "custom_staff", "custom@example.edu");
    const { role } = await app.concepts.Roling.defineRole({
      name: "course-staff",
      capabilities: ["course:manage"],
    });
    await app.concepts.Roling.assign({ user: staff.user, context: "forum", role });
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [{ email: "custom@example.edu", kind: "STAFF" }],
    });
    await app.concepts.Rostering.claimSeat({ seat: created[0]._id, user: staff.user });

    expect(
      await app.concepts.Roling._hasCapability({
        user: staff.user,
        context: "forum",
        capability: "course:manage",
      }),
    ).toEqual({ allowed: true });

    await app.concepts.Rostering.dropSeat({ seat: created[0]._id });

    expect(
      await app.concepts.Roling._hasCapability({
        user: staff.user,
        context: "forum",
        capability: "course:manage",
      }),
    ).toEqual({ allowed: true });
  });

  test("the staff dashboard counts active course work", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const at = new Date("2026-07-19T12:00:00.000Z");
    const { assignment } = await app.concepts.Assigning.createDraft({
      author: "staff",
      title: "Design exercise",
      instructions: "Make the behavior legible.",
      kind: "HOMEWORK",
      availableAt: "2026-07-19T12:00:00.000Z",
      dueAt: "2026-07-20T12:00:00.000Z",
      closeAt: "2026-07-21T12:00:00.000Z",
      acceptsSubmissions: true,
      audience: "EVERYONE",
      targets: [],
      at,
    });
    await app.concepts.Itemizing.configureItem({
      item: assignment,
      label: "Design exercise",
      maxPoints: 100,
    });
    const { created } = await app.concepts.Rostering.importSeats({
      rows: [{ email: "student@example.edu", kind: "STUDENT" }],
    });
    await app.concepts.Rostering.claimSeat({ seat: created[0]._id, user: "learner" });
    await app.concepts.Banking.setTerms({ allowance: 2, perItemLimit: 5, unitHours: 24 });
    await app.concepts.Banking.apply({ learner: "learner", item: assignment, days: 1, at });

    expect(await app.form(theStaffDashboardCounts({}))).toEqual({
      assignments: 1,
      gradeItems: 1,
      lateDayUses: 1,
    });
  });
});

describe("consolidated reaction groups", () => {
  test("deleting a leaf post asks every cleanup sibling", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const at = new Date("2026-07-20T12:00:00.000Z");
    const { post } = await app.concepts.Posting.create({ author: "author", content: "Body", at });
    await app.concepts.Conversing.start({ item: post, at });
    const before = inspectAssembly(app).occurrences.length;

    await app.concepts.Posting.delete({ post });

    const asks = inspectAssembly(app)
      .occurrences.slice(before)
      .map((event) => event.by)
      .filter(
        (by): by is string => by?.startsWith("Forum.posts.DeletedPostClearsSatellites:") ?? false,
      )
      .sort((left, right) => left.localeCompare(right));
    expect(asks).toEqual([
      "Forum.posts.DeletedPostClearsSatellites:backlinks",
      "Forum.posts.DeletedPostClearsSatellites:bookmarks",
      "Forum.posts.DeletedPostClearsSatellites:formatting",
      "Forum.posts.DeletedPostClearsSatellites:leaf-node",
      "Forum.posts.DeletedPostClearsSatellites:links",
      "Forum.posts.DeletedPostClearsSatellites:pins",
      "Forum.posts.DeletedPostClearsSatellites:reactions",
      "Forum.posts.DeletedPostClearsSatellites:tags",
      "Forum.posts.DeletedPostClearsSatellites:tracking",
    ]);
  });

  test("purging a post keeps direct and deletion cleanup occurrences", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const at = new Date("2026-07-20T12:00:00.000Z");
    const { post } = await app.concepts.Posting.create({ author: "author", content: "Body", at });
    await app.concepts.Conversing.start({ item: post, at });
    await app.concepts.Trashing.trash({ item: post, by: "moderator", at });
    const before = inspectAssembly(app).occurrences.length;

    await app.concepts.Trashing.purge({ item: post });

    const formattingClears = inspectAssembly(app)
      .occurrences.slice(before)
      .filter((event) => event.concept === "Formatting" && event.action === "clear")
      .map((event) => event.by)
      .sort((left, right) => left!.localeCompare(right!));
    expect(formattingClears).toEqual([
      "Forum.posts.DeletedPostClearsSatellites:formatting",
      "Forum.purge.PurgeClearsCoreForumState:formatting",
    ]);

    const nodeRemovals = inspectAssembly(app)
      .occurrences.slice(before)
      .filter((event) => event.concept === "Conversing" && event.action === "remove");
    expect(nodeRemovals).toHaveLength(1);
    expect(nodeRemovals[0].by).toBe("Forum.posts.DeletedPostClearsSatellites:leaf-node");
    expect(nodeRemovals[0].outcome?.kind).toBe("result");
  });

  test("reply purge preserves conversation state and root purge clears it", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const at = new Date("2026-07-20T12:00:00.000Z");
    const { post: root } = await app.concepts.Posting.create({
      author: "author",
      content: "Root",
      at,
    });
    const { conversation, node } = await app.concepts.Conversing.start({ item: root, at });
    const { post: reply } = await app.concepts.Posting.create({
      author: "reader",
      content: "Reply",
      at,
    });
    await app.concepts.Conversing.reply({ item: reply, parent: node, at });
    await app.concepts.Subscribing.subscribe({ user: "reader", target: conversation, at });
    await app.concepts.Locking.lock({ target: conversation, at });

    await app.concepts.Trashing.trash({ item: reply, by: "moderator", at });
    await app.concepts.Trashing.purge({ item: reply });
    expect(
      await app.concepts.Subscribing._isSubscribed({ user: "reader", target: conversation }),
    ).toEqual({ subscribed: true });
    expect(await app.concepts.Locking._isLocked({ target: conversation })).toEqual({
      locked: true,
    });

    expect(await app.form(theHomeFeedByCreation({}))).toHaveLength(1);
    await app.concepts.Trashing.trash({ item: root, by: "moderator", at });
    await app.concepts.Trashing.purge({ item: root });
    expect(
      await app.concepts.Subscribing._isSubscribed({ user: "reader", target: conversation }),
    ).toEqual({ subscribed: false });
    expect(await app.concepts.Locking._isLocked({ target: conversation })).toEqual({
      locked: false,
    });
    expect(await app.form(theHomeFeedByCreation({}))).toEqual([]);
    expect(await app.form(theThread({ conversation }))).toEqual([]);
    expect(await app.form(theThreadContext({ conversation }))).toEqual([]);
  });

  test("purging a resolved answer clears both resolution roles", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const at = new Date("2026-07-20T12:00:00.000Z");
    await app.concepts.Resolving.accept({
      question: "question",
      answer: "answer",
      by: "author",
      at,
    });
    await app.concepts.Resolving.accept({
      question: "answer",
      answer: "nested-answer",
      by: "author",
      at,
    });
    await app.concepts.Trashing.trash({ item: "answer", by: "moderator", at });
    const before = inspectAssembly(app).occurrences.length;

    await app.concepts.Trashing.purge({ item: "answer" });

    const clears = inspectAssembly(app)
      .occurrences.slice(before)
      .filter((event) => event.concept === "Resolving" && event.action === "clear")
      .map((event) => event.by)
      .sort((left, right) => left!.localeCompare(right!));
    expect(clears).toEqual([
      "Forum.resolutions.PurgedPostClearsResolutions:answer",
      "Forum.resolutions.PurgedPostClearsResolutions:question",
    ]);
  });
});

afterAll(stopTestDb);

import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

async function forum() {
  const db = await testDb();
  const floor = mongoImplementations(db);
  const people = await Promise.all(
    ["student", "classmate", "staff", "outsider"].map(async (username) => {
      const { user } = await floor.Authenticating.register({
        username,
        email: `${username}@example.edu`,
        password: "test-password",
      });
      const { session } = await floor.Sessioning.start({ user });
      return { user, session };
    }),
  );
  const [student, classmate, staff, outsider] = people;
  const { role } = await floor.Roling.defineRole({
    name: "Staff",
    capabilities: ["course:manage"],
  });
  await floor.Roling.assign({ user: staff.user, context: "commons", role });
  const { role: moderator } = await floor.Roling.defineRole({
    name: "Moderator only",
    capabilities: ["moderate"],
  });
  await floor.Roling.assign({ user: classmate.user, context: "commons", role: moderator });

  let tick = 1700000000000;
  async function thread(author: string, content: string, holders: string[]) {
    const at = new Date((tick += 1000));
    const { post } = await floor.Posting.create({ author, content, at });
    const placement = await floor.Conversing.start({ item: post, at });
    await floor.Accessing.establish({ resource: placement.conversation, holders });
    return { post, ...placement };
  }
  async function reply(parent: string, author: string, content: string) {
    const at = new Date((tick += 1000));
    const { post } = await floor.Posting.create({ author, content, at });
    await floor.Conversing.reply({ parent, item: post, at });
    return post;
  }

  const edge = createEdge(floor, "https://commons.test");
  async function call(path: string, input: Record<string, unknown>, actor: { session: string }) {
    const response = await edge.fetch(
      new Request(`https://commons.test/api${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://commons.test",
          Cookie: `__Host-commons-session=${actor.session}`,
        },
        body: JSON.stringify(input),
      }),
    );
    // oxlint-disable-next-line typescript/no-explicit-any
    return { status: response.status, body: (await response.json()) as any };
  }
  return { db, floor, student, classmate, staff, outsider, thread, reply, call };
}

const shared = (...users: string[]) => [...users.map((u) => `account:${u}`), "standing:staff"];

test("search finds titles and replies the reader can read, and nothing else", async () => {
  const { db, floor, student, classmate, staff, outsider, thread, reply, call } = await forum();
  try {
    const open = await thread(
      student.user,
      "# Recursion help\nWhy does my base case never fire?",
      shared(student.user, classmate.user),
    );
    const answer = await reply(open.node, classmate.user, "Check the RECURSION depth (n-1).");
    const secret = await thread(outsider.user, "# Private recursion question\nOnly for me.", [
      `account:${outsider.user}`,
    ]);
    const unrelated = await thread(student.user, "# Lunch plans", shared(student.user));

    const search = async (text: unknown, actor = student) =>
      call("/discussions/search", { text }, actor);
    const hits = async (text: string, actor = student) =>
      ((await search(text, actor)).body.matches as { conversation: string; post: string }[]).map(
        (row) => `${row.conversation}/${row.post}`,
      );

    // Titles and bodies of openings, and replies, match regardless of case, newest first.
    expect(await hits("recursion")).toEqual([
      `${open.conversation}/${answer}`,
      `${open.conversation}/${open.post}`,
    ]);
    // The outsider's private thread is invisible to the student and to staff outside its audience.
    expect(await hits("private recursion")).toEqual([]);
    expect(await hits("private recursion", staff)).toEqual([]);
    expect(await hits("private recursion", outsider)).toEqual([
      `${secret.conversation}/${secret.post}`,
    ]);
    // The outsider sees nothing of the shared thread.
    expect(await hits("base case", outsider)).toEqual([]);
    // Pattern characters are literal.
    expect(await hits("(n-1)")).toEqual([`${open.conversation}/${answer}`]);
    expect(await hits(".*")).toEqual([]);
    expect(await hits("lunch")).toEqual([`${unrelated.conversation}/${unrelated.post}`]);

    // A trashed reply drops out; a trashed thread drops out entirely.
    await floor.Trashing.trash({ item: answer, by: staff.user, at: new Date() });
    expect(await hits("recursion")).toEqual([`${open.conversation}/${open.post}`]);
    await floor.Trashing.trash({ item: open.conversation, by: staff.user, at: new Date() });
    expect(await hits("recursion")).toEqual([]);

    // Losing audience admission removes matches.
    await floor.Accessing.retire({ resource: unrelated.conversation });
    expect(await hits("lunch")).toEqual([]);

    // Posts not placed in a conversation (such as submissions) never surface.
    await floor.Posting.create({ author: student.user, content: "lunch artifact", at: new Date() });
    expect(await hits("lunch artifact")).toEqual([]);

    for (const text of ["", "   ", "x".repeat(201), null, 5, { $ne: "" }]) {
      expect(await search(text)).toEqual({ status: 400, body: { error: "INVALID_REQUEST" } });
    }
  } finally {
    await db.dropDatabase();
  }
});

test("only staff pin discussions, and every reader sees only pins they may read", async () => {
  const { db, student, classmate, staff, outsider, thread, call, floor } = await forum();
  try {
    const first = await thread(student.user, "# First", shared(student.user, classmate.user));
    const second = await thread(student.user, "# Second", shared(student.user, classmate.user));
    const secret = await thread(outsider.user, "# Secret", [
      `account:${outsider.user}`,
      "standing:staff",
    ]);
    const hidden = await thread(outsider.user, "# Hidden", [`account:${outsider.user}`]);

    const pinned = async (actor: { session: string }) =>
      (
        (await call("/discussions/pinned", {}, actor)).body.pinned as { conversation: string }[]
      ).map((row) => row.conversation);

    // Students and moderators outside Staff are refused.
    expect(await call("/discussions/pin", { conversation: first.conversation }, student)).toEqual({
      status: 403,
      body: { error: "FORBIDDEN" },
    });
    expect(
      (await call("/discussions/pin", { conversation: first.conversation }, classmate)).body,
    ).toEqual({ error: "FORBIDDEN" });
    // A discussion staff cannot read is NOT_FOUND, never confirmed.
    expect(
      (await call("/discussions/pin", { conversation: hidden.conversation }, staff)).body,
    ).toEqual({ error: "NOT_FOUND" });
    expect((await call("/discussions/pin", { conversation: "missing" }, staff)).body).toEqual({
      error: "NOT_FOUND",
    });

    for (const conversation of [first.conversation, second.conversation, secret.conversation]) {
      expect((await call("/discussions/pin", { conversation }, staff)).body).toEqual({
        conversation,
      });
    }
    // Pinning twice is harmless.
    expect(
      (await call("/discussions/pin", { conversation: first.conversation }, staff)).status,
    ).toBe(200);

    // Pins are shared by everyone, most recent first, filtered by each reader's access.
    expect(await pinned(staff)).toEqual([
      secret.conversation,
      second.conversation,
      first.conversation,
    ]);
    expect(await pinned(student)).toEqual([second.conversation, first.conversation]);
    expect(await pinned(classmate)).toEqual([second.conversation, first.conversation]);
    expect(await pinned(outsider)).toEqual([secret.conversation]);

    // Students cannot unpin either.
    expect(
      (await call("/discussions/unpin", { conversation: second.conversation }, student)).body,
    ).toEqual({ error: "FORBIDDEN" });
    expect(
      (await call("/discussions/unpin", { conversation: second.conversation }, staff)).body,
    ).toEqual({ conversation: second.conversation });
    expect(await pinned(student)).toEqual([first.conversation]);

    // A trashed discussion's pin is hidden until restored.
    await floor.Trashing.trash({ item: first.conversation, by: staff.user, at: new Date() });
    expect(await pinned(student)).toEqual([]);
    await floor.Trashing.restore({ item: first.conversation });
    expect(await pinned(student)).toEqual([first.conversation]);

    // Thread pins never leak into a conversation's own post pins.
    expect(await floor.Pinning._getPinned({ scope: first.conversation })).toEqual([]);
  } finally {
    await db.dropDatabase();
  }
});

test("stars are private to each account and kept on the server", async () => {
  const { db, floor, student, classmate, outsider, thread, call } = await forum();
  try {
    const a = await thread(student.user, "# A", shared(student.user, classmate.user));
    const b = await thread(student.user, "# B", shared(student.user, classmate.user));
    const secret = await thread(outsider.user, "# Secret", [`account:${outsider.user}`]);

    const starred = async (actor: { session: string }) =>
      (
        (await call("/discussions/starred", {}, actor)).body.starred as { conversation: string }[]
      ).map((row) => row.conversation);

    expect(
      (await call("/discussions/star", { conversation: a.conversation }, student)).body,
    ).toEqual({ conversation: a.conversation, starred: true });
    await call("/discussions/star", { conversation: b.conversation }, student);
    // Starring again is harmless.
    expect(
      (await call("/discussions/star", { conversation: b.conversation }, student)).status,
    ).toBe(200);
    expect(await starred(student)).toEqual([b.conversation, a.conversation]);
    // Another account's stars are its own.
    expect(await starred(classmate)).toEqual([]);
    await call("/discussions/star", { conversation: a.conversation }, classmate);
    expect(await starred(classmate)).toEqual([a.conversation]);
    expect(await starred(student)).toEqual([b.conversation, a.conversation]);

    // A discussion the caller cannot read cannot be starred.
    expect(
      (await call("/discussions/star", { conversation: secret.conversation }, student)).body,
    ).toEqual({ error: "NOT_FOUND" });

    // A new session for the same account sees the same stars.
    const { session } = await floor.Sessioning.start({ user: student.user });
    expect(await starred({ session })).toEqual([b.conversation, a.conversation]);

    // Losing access hides a star without forgetting it.
    await floor.Accessing.retire({ resource: b.conversation });
    expect(await starred(student)).toEqual([a.conversation]);

    expect(
      (await call("/discussions/unstar", { conversation: a.conversation }, student)).body,
    ).toEqual({ conversation: a.conversation, starred: false });
    expect(
      (await call("/discussions/unstar", { conversation: a.conversation }, student)).body,
    ).toEqual({ conversation: a.conversation, starred: false });
    expect(await starred(student)).toEqual([]);
    expect(await starred(classmate)).toEqual([a.conversation]);

    // Stars are not post bookmarks.
    expect(await floor.Bookmarking._getSaved({ user: classmate.user })).toEqual([]);
  } finally {
    await db.dropDatabase();
  }
});

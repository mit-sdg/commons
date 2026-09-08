import { afterAll, expect, test } from "vite-plus/test";
import type { CommonsWire } from "../../generated/wire.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

test("selected controls preserve individual answers, link privacy and current membership", async () => {
  const db = await testDb();
  const floor = mongoImplementations(db);
  const at = new Date();
  const [student, staff, outsider] = await Promise.all(
    ["student", "staff", "outsider"].map(async (username) => {
      const { user } = await floor.Authenticating.register({
        username,
        email: `${username}@example.edu`,
        password: "test-password",
      });
      const { session } = await floor.Sessioning.start({ user });
      return { user, session };
    }),
  );
  const { role } = await floor.Roling.defineRole({ name: "Staff", capabilities: ["moderate"] });
  await floor.Roling.assign({ user: staff.user, context: "commons", role });
  const { group } = await floor.Grouping.create({
    title: "Study group",
    creator: student.user,
    at,
  });
  await floor.Grouping.addMember({ group, member: student.user, candidate: staff.user, at });
  const { post } = await floor.Posting.create({ author: student.user, content: "question", at });
  const { conversation, node } = await floor.Conversing.start({ item: post, at });
  await floor.Accessing.establish({
    resource: conversation,
    holders: [`group:${group}`, `account:${staff.user}`],
  });
  const { post: reply } = await floor.Posting.create({
    author: student.user,
    content: "reply",
    at,
  });
  await floor.Conversing.reply({ parent: node, item: reply, at });
  const { post: hidden } = await floor.Posting.create({
    author: outsider.user,
    content: "secret",
    at,
  });
  const privateThread = await floor.Conversing.start({ item: hidden, at });
  await floor.Accessing.establish({
    resource: privateThread.conversation,
    holders: [`account:${outsider.user}`],
  });
  await floor.Linking.setLinks({ source: post, targets: [reply, hidden, reply, "missing"] });
  await floor.Linking.setLinks({ source: reply, targets: [post] });
  await floor.Linking.setLinks({ source: hidden, targets: [post] });
  await floor.Bookmarking.save({ user: student.user, item: post, at });
  await floor.Pinning.pin({ item: reply, scope: conversation, priority: 0, at });
  await floor.Reacting.react({ reactor: student.user, target: post, kind: "❤️", at });
  await floor.Reacting.react({ reactor: staff.user, target: post, kind: "👍", at });
  await floor.Reacting.react({ reactor: student.user, target: post, kind: "👍", at });
  const enriched: string[] = [];
  const saved = floor.Bookmarking._isSaved.bind(floor.Bookmarking);
  floor.Bookmarking._isSaved = async (input) => {
    enriched.push(input.item);
    return saved(input);
  };
  const edge = createEdge(floor, "https://commons.test");
  async function call<P extends keyof CommonsWire>(
    path: P,
    input: Record<string, unknown>,
    actor = student,
  ) {
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
    return { status: response.status, body: (await response.json()) as CommonsWire[P]["output"] };
  }
  const selection = { conversation, posts: [post, reply, post, hidden, "missing"] };
  for (const actor of [student, staff]) {
    const batch = await call(
      "/threads/post-controls",
      { ...selection, reader: outsider.user },
      actor,
    );
    expect(batch.status).toBe(200);
    expect(batch.body.posts.map((row) => row.post)).toEqual([post, reply]);
    for (const row of batch.body.posts) {
      const input = { item: row.post };
      expect(row.saved).toBe((await call("/bookmarks/isSaved", input, actor)).body.saved);
      expect(row.pinned).toBe(
        (await call("/pins/isPinned", { ...input, scope: conversation }, actor)).body.pinned,
      );
      expect(row.backlinks).toBe(
        (await call("/links/backlinks", { target: row.post }, actor)).body.sources.length,
      );
      expect(row.forwardLinks).toBe(
        (await call("/links/forward", { source: row.post }, actor)).body.targets.length,
      );
      const existing = (await call("/reactions/forTarget", { target: row.post }, actor)).body
        .reactions;
      const groups = new Map<string, { kind: string; count: number; mine: boolean }>();
      for (const reaction of existing) {
        const group = groups.get(reaction.kind) ?? { kind: reaction.kind, count: 0, mine: false };
        group.count += 1;
        group.mine ||= reaction.user === actor.user;
        groups.set(reaction.kind, group);
      }
      expect(row.reactions).toEqual([...groups.values()].sort((a, b) => b.count - a.count));
      expect(JSON.stringify(row)).not.toContain(hidden);
      expect(JSON.stringify(row.reactions)).not.toContain(actor.user);
    }
  }
  expect(enriched).not.toContain(hidden);
  const denied = await call("/threads/post-controls", selection, outsider);
  expect(denied).toEqual({ status: 404, body: { error: "NOT_FOUND" } });
  expect(
    await call("/threads/post-controls", { conversation: "missing", posts: [] }, outsider),
  ).toEqual(denied);
  expect((await call("/threads/post-controls", { conversation, posts: [] })).body).toEqual({
    posts: [],
  });
  expect(
    (await call("/threads/post-controls", { conversation, posts: Array(32).fill(post) })).body
      .posts,
  ).toHaveLength(1);
  for (const posts of [Array(33).fill(post), [""], ["x".repeat(257)], [1], null, "post"]) {
    enriched.length = 0;
    expect((await call("/threads/post-controls", { conversation, posts })).status).toBe(400);
    expect(enriched).toEqual([]);
  }
  await floor.Trashing.trash({ item: reply, by: staff.user, at });
  const afterTrash = await call("/threads/post-controls", selection);
  expect(afterTrash.body.posts).toHaveLength(1);
  expect(afterTrash.body.posts[0]).toMatchObject({ post, backlinks: 0, forwardLinks: 0 });
  await floor.Trashing.restore({ item: reply });
  await floor.Posting.delete({ post: reply });
  expect(
    (await call("/threads/post-controls", selection)).body.posts.map((row) => row.post),
  ).toEqual([post]);
  await floor.Grouping.leave({ group, member: student.user, at });
  expect(await call("/threads/post-controls", selection)).toEqual(denied);
  expect((await call("/threads/post-controls", selection, staff)).body.posts).toHaveLength(1);
  await floor.Archiving.trash({ item: staff.user, by: outsider.user, at });
  expect((await call("/threads/post-controls", selection, staff)).status).not.toBe(200);
});

import type { CommonsWire } from "../../generated/wire.ts";
import { afterAll, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

afterAll(stopTestDb);

test("feed metadata avoids bodies and selected summaries bound enrichment and recheck privacy", async () => {
  const db = await testDb();
  try {
    const floor = mongoImplementations(db);
    const people = await Promise.all(
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
    const [student, staff, outsider] = people;
    const { role } = await floor.Roling.defineRole({
      name: "Staff",
      capabilities: ["course:manage"],
    });
    await floor.Roling.assign({ user: staff.user, context: "commons", role });
    const rows = [];
    for (let n = 0; n < 28; n++) {
      const at = new Date(1700000000000 + n * 1000);
      const author = n === 27 ? outsider.user : n === 26 ? staff.user : student.user;
      const { post } = await floor.Posting.create({
        author,
        content: `# Topic ${n}\nShort preview\n${"FULL_BODY_MARKER ".repeat(40)}`,
        at,
      });
      const placement = await floor.Conversing.start({ item: post, at });
      await floor.Accessing.establish({
        resource: placement.conversation,
        holders:
          n === 27 ? [`account:${outsider.user}`] : [`account:${student.user}`, "standing:staff"],
      });
      rows.push({ post, ...placement });
    }
    const bodies: string[] = [];
    const get = floor.Posting._getPost.bind(floor.Posting);
    floor.Posting._getPost = async (input) => {
      bodies.push(input.post);
      return get(input);
    };
    const locks: string[] = [];
    const locked = floor.Locking._isLocked.bind(floor.Locking);
    floor.Locking._isLocked = async (input) => {
      locks.push(input.target);
      return locked(input);
    };
    const edge = createEdge(floor, "https://commons.test");
    async function call<P extends "/threads/index" | "/threads/summaries">(
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
    for (const order of ["latest", "activity"]) {
      const index = await call("/threads/index", { order });
      expect(index.status).toBe(200);
      expect(index.body.conversations.map((r: { conversation: string }) => r.conversation)).toEqual(
        rows
          .slice(0, 27)
          .reverse()
          .map((r) => r.conversation),
      );
      expect(index.body.conversations[0].staffQuestion).toBe(false);
      expect(index.body.conversations[1].staffQuestion).toBe(true);
      expect(JSON.stringify(index)).not.toContain("FULL_BODY_MARKER");
    }
    expect(bodies).toEqual([]);
    expect(locks).toEqual([]);
    const selected = rows.slice(0, 25);
    const summaries = await call("/threads/summaries", {
      conversations: selected.map((r) => r.conversation),
      reader: outsider.user,
    });
    expect(summaries.status).toBe(200);
    expect(summaries.body.conversations).toHaveLength(25);
    expect(new Set(bodies)).toEqual(new Set(selected.map((r) => r.post)));
    expect(new Set(locks)).toEqual(new Set(selected.map((r) => r.conversation)));
    const post = summaries.body.conversations[0].post;
    expect(post.preview?.title).toBe("Topic 24");
    expect(post.preview?.excerpt.length).toBeLessThanOrEqual(181);
    expect(post).not.toHaveProperty("content");
    expect(
      (
        await call(
          "/threads/summaries",
          { conversations: selected.map((r) => r.conversation) },
          outsider,
        )
      ).body,
    ).toEqual({ conversations: [] });
    await floor.Accessing.retire({ resource: rows[0].conversation });
    const afterRevocation = await call("/threads/summaries", {
      conversations: [
        rows[0].conversation,
        rows[1].conversation,
        rows[1].conversation,
        "missing",
        rows[27].conversation,
      ],
    });
    expect(
      afterRevocation.body.conversations.map((r: { conversation: string }) => r.conversation),
    ).toEqual([rows[1].conversation]);
    await floor.Trashing.trash({ item: rows[1].post, by: student.user, at: new Date() });
    const trashed = await call("/threads/summaries", { conversations: [rows[1].conversation] });
    expect(trashed.body.conversations[0]).toMatchObject({
      staffQuestion: false,
      post: { preview: null, author: null },
      replyCount: 0,
      participants: [],
    });
    const at = new Date();
    const { post: reply } = await floor.Posting.create({
      author: student.user,
      content: "Surviving reply",
      at,
    });
    await floor.Conversing.reply({ parent: rows[2].node, item: reply, at });
    await floor.Posting.delete({ post: rows[2].post });
    const surviving = await call("/threads/summaries", { conversations: [rows[2].conversation] });
    expect(surviving.body.conversations[0]).toMatchObject({
      post: { preview: null, author: null },
      staffQuestion: false,
      replyCount: 1,
      participants: [student.user],
    });
    const { group } = await floor.Grouping.create({
      title: "Shared group",
      creator: student.user,
      at,
    });
    await floor.Grouping.addMember({ group, member: student.user, candidate: outsider.user, at });
    async function groupThread(holders: string[]) {
      const { post } = await floor.Posting.create({
        author: student.user,
        content: "# Group discussion",
        at,
      });
      const { conversation } = await floor.Conversing.start({ item: post, at });
      await floor.Accessing.establish({ resource: conversation, holders });
      return conversation;
    }
    const groupOnly = await groupThread([`group:${group}`]);
    const explicit = await groupThread([`group:${group}`, `account:${outsider.user}`]);
    const selectedGroups = { conversations: [groupOnly, explicit] };
    expect(
      (await call("/threads/summaries", selectedGroups, outsider)).body.conversations,
    ).toHaveLength(2);
    expect((await call("/threads/summaries", selectedGroups, staff)).body.conversations).toEqual(
      [],
    );
    await floor.Grouping.leave({ group, member: outsider.user, at });
    const groupIndex = await call("/threads/index", { order: "latest" }, outsider);
    expect(groupIndex.body.conversations.map((row) => row.conversation)).toContain(explicit);
    expect(groupIndex.body.conversations.map((row) => row.conversation)).not.toContain(groupOnly);
    expect(
      (await call("/threads/summaries", selectedGroups, outsider)).body.conversations.map(
        (row) => row.conversation,
      ),
    ).toEqual([explicit]);
    const bodyCount = bodies.length;
    const lockCount = locks.length;
    for (const conversations of [
      null,
      {},
      "a",
      [null],
      [""],
      ["x".repeat(257)],
      Array(26).fill("x"),
    ]) {
      expect(await call("/threads/summaries", { conversations })).toEqual({
        status: 400,
        body: { error: "INVALID_REQUEST" },
      });
    }
    expect(await call("/threads/index", { order: "unknown" })).toEqual({
      status: 400,
      body: { error: "INVALID_REQUEST" },
    });
    expect(bodies).toHaveLength(bodyCount);
    expect(locks).toHaveLength(lockCount);
    expect(await call("/threads/summaries", { conversations: [] })).toEqual({
      status: 200,
      body: { conversations: [] },
    });
  } finally {
    await db.dropDatabase();
  }
});

import { afterAll, expect, test } from "vite-plus/test";
import type { CommonsBrowserWire } from "../../src/client.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";
import { forumMailEligibility } from "../../src/email/forum-policy.ts";

const origin = "https://commons.test";
const missing = { status: 404, body: { error: "NOT_FOUND" } };
const forbidden = { status: 403, body: { error: "FORBIDDEN" } };
// The edge publishes only the category of the THREAD_OPENING refusal.
const opening = { status: 409, body: { error: "CONFLICT" } };
afterAll(stopTestDb);

for (const audience of ["private", "everyone"] as const) {
  test.each(["moderate", "administer"])(
    `${audience} trash acts on one reply or one whole thread, never widening author permissions (%s)`,
    async (capability) => {
      const floor = mongoImplementations(await testDb());
      const [author, reader, moderator, outsider] = await Promise.all(
        ["author", "reader", "moderator", "outsider"].map(async (username) => {
          const email = `${username}@example.edu`;
          const { user } = await floor.Authenticating.register({
            username,
            email,
            password: "test-password",
          });
          const { session } = await floor.Sessioning.start({ user });
          await floor.Rostering.enrol({ user, email, kind: "STUDENT", section: null });
          return { user, session };
        }),
      );
      const { role } = await floor.Roling.defineRole({
        name: "Moderator",
        capabilities: [capability],
      });
      for (const actor of [moderator, outsider])
        await floor.Roling.assign({ user: actor.user, context: "commons", role });
      const edge = createEdge(floor, origin);
      async function call<P extends keyof CommonsBrowserWire>(
        path: P,
        input: CommonsBrowserWire[P]["input"],
        actor = author,
      ) {
        const response = await edge.fetch(
          new Request(`${origin}/api${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: origin,
              Cookie: `__Host-commons-session=${actor.session}`,
            },
            body: JSON.stringify(input),
          }),
        );
        return { status: response.status, body: await response.json() };
      }
      async function ok<P extends keyof CommonsBrowserWire>(
        path: P,
        input: CommonsBrowserWire[P]["input"],
        actor = author,
      ) {
        const result = await call(path, input, actor);
        expect(result.status, `${path}: ${JSON.stringify(result.body)}`).toBe(200);
        return result.body as CommonsBrowserWire[P]["output"];
      }
      const holders =
        audience === "private"
          ? [author, reader, moderator].map(({ user }) => `account:${user}`)
          : ["standing:everyone"];
      const root = await ok("/threads/create", { content: "# Removed discussion", holders });
      const middle = await ok(
        "/threads/reply",
        { parent: root.node, content: "Moderated reply" },
        moderator,
      );
      const leaf = await ok(
        "/threads/reply",
        { parent: middle.node, content: "Retained nested reply" },
        reader,
      );
      const other = await ok("/threads/create", { content: "# Unaffected discussion", holders });
      await ok("/subscriptions/subscribe", { target: root.conversation }, reader);
      await ok("/bookmarks/save", { item: leaf.post }, reader);
      await ok("/reactions/add", { target: leaf.post, kind: "like" }, reader);
      const mail = (await floor.Mailing._getPending({})).find((m) => m.key.includes(leaf.post));
      expect(mail).toBeDefined();
      expect(await forumMailEligibility(edge.application)(mail!)).toBe(true);

      // Delete remains author-only and leaf-only, even for a moderator's own reply.
      const conflict = { status: 409, body: { error: "CONFLICT" } };
      expect(await call("/posts/delete", { post: root.post })).toEqual(conflict);
      expect(await call("/posts/delete", { post: middle.post }, moderator)).toEqual(conflict);
      expect(await call("/posts/delete", { post: root.post }, moderator)).toEqual(forbidden);
      expect(await call("/posts/delete", { post: leaf.post })).toEqual(forbidden);
      for (const item of [root.post, root.conversation, other.post])
        expect(await call("/trash/trash", { item })).toEqual(forbidden);
      expect(await call("/trash/trash", { item: leaf.post }, reader)).toEqual(forbidden);
      if (audience === "private") {
        expect(await call("/trash/trash", { item: root.post }, outsider)).toEqual(missing);
        expect(await call("/trash/trash", { item: root.conversation }, outsider)).toEqual(missing);
      }
      // The opening post is trashed only with its thread.
      expect(await call("/trash/trash", { item: root.post }, moderator)).toEqual(opening);

      // A trashed reply is a removed position: its own replies stay readable and nested.
      await ok("/trash/trash", { item: middle.post }, moderator);
      const withRemoved = await ok("/threads/get", { conversation: root.conversation }, reader);
      expect(withRemoved.thread.map((p) => p.item)).toEqual([root.post, leaf.post]);
      expect(withRemoved.context[0].structure.map((p) => p.node)).toEqual([
        root.node,
        middle.node,
        leaf.node,
      ]);
      expect(withRemoved.context[0].replyCount).toBe(1);
      expect(await call("/posts/get", { post: middle.post })).toEqual(missing);
      expect((await ok("/posts/get", { post: leaf.post })).post.content).toBe(
        "Retained nested reply",
      );
      expect(await ok("/trash/isTrashed", { item: middle.post }, moderator)).toEqual({
        trashed: true,
      });
      expect((await ok("/trash/list", {}, moderator)).trashed).toEqual([
        expect.objectContaining({ item: middle.post, thread: false, opening: null }),
      ]);
      await ok("/trash/restore", { item: middle.post }, moderator);
      expect(
        (await ok("/threads/get", { conversation: root.conversation })).thread.map((p) => p.item),
      ).toEqual([root.post, middle.post, leaf.post]);

      async function assertHidden() {
        for (const actor of [author, reader, moderator]) {
          expect(await call("/threads/get", { conversation: root.conversation }, actor)).toEqual(
            missing,
          );
          for (const post of [root.post, middle.post, leaf.post])
            expect(await call("/posts/get", { post }, actor)).toEqual(missing);
          expect(await ok("/threads/forItem", { item: leaf.post }, actor)).toEqual({
            conversation: null,
          });
          for (const path of ["/threads/latest", "/threads/activity"] as const)
            expect((await ok(path, {}, actor)).conversations.map((c) => c.conversation)).toEqual([
              other.conversation,
            ]);
          for (const order of ["latest", "activity"] as const)
            expect(
              (await ok("/threads/index", { order }, actor)).conversations.map(
                (c) => c.conversation,
              ),
            ).toEqual([other.conversation]);
          expect(
            await ok("/threads/summaries", { conversations: [root.conversation] }, actor),
          ).toEqual({ conversations: [] });
          expect(
            await call("/audiences/forConversation", { conversation: root.conversation }, actor),
          ).toEqual(missing);
          expect(
            await call(
              "/threads/post-controls",
              { conversation: root.conversation, posts: [leaf.post] },
              actor,
            ),
          ).toEqual(missing);
          expect(await call("/unread/list", { scope: root.conversation }, actor)).toEqual(missing);
          expect(
            await call("/subscriptions/subscribers", { target: root.conversation }, actor),
          ).toEqual(missing);
        }
        expect(await ok("/subscriptions/mine", {}, reader)).toEqual({ subscriptions: [] });
        expect(await ok("/bookmarks/list", {}, reader)).toEqual({ bookmarks: [] });
        expect((await ok("/posts/byAuthor", { author: reader.user })).posts).toEqual([]);
        expect((await ok("/notifications/inbox", {})).notifications).toEqual([]);
        expect(await ok("/notifications/unreadCount", {})).toEqual({ count: 0 });
        expect(await forumMailEligibility(edge.application)(mail!)).toBe(false);
        for (const parent of [root.node, leaf.node])
          expect(
            await call("/threads/reply", { parent, content: "Must not be created" }, reader),
          ).toEqual(missing);
        expect(
          await call("/posts/edit", { post: leaf.post, content: "Must not change" }, reader),
        ).toEqual(missing);
        expect(await call("/posts/delete", { post: leaf.post }, reader)).toEqual(missing);
        expect(await call("/reactions/add", { target: leaf.post, kind: "like" })).toEqual(missing);
      }

      // Trashing the conversation hides the whole thread with one marker.
      await ok("/trash/trash", { item: root.conversation }, moderator);
      await assertHidden();
      expect((await ok("/trash/list", {}, moderator)).trashed).toEqual([
        expect.objectContaining({
          item: root.conversation,
          thread: true,
          opening: root.post,
          trashedBy: moderator.user,
        }),
      ]);
      // The bin can show the hidden thread's opening; nobody else can.
      expect((await ok("/moderation/posts/get", { item: root.post }, moderator)).post.content).toBe(
        "# Removed discussion",
      );
      expect(
        (await ok("/moderation/revisions/list", { item: root.post }, moderator)).revisions,
      ).toHaveLength(1);
      expect(await call("/moderation/posts/get", { item: root.post })).toEqual(missing);
      for (const path of ["/trash/restore", "/trash/purge"] as const) {
        expect(await call(path, { item: root.conversation })).toEqual(forbidden);
        if (audience === "private")
          expect(await call(path, { item: root.conversation }, outsider)).toEqual(missing);
      }
      // The thread marker is the whole switch: no post inside gained its own.
      for (const post of [root.post, middle.post, leaf.post])
        expect(await floor.Trashing._isTrashed({ item: post })).toEqual({ trashed: false });

      await ok("/trash/restore", { item: root.conversation }, moderator);
      const restored = await ok("/threads/get", { conversation: root.conversation }, reader);
      expect(restored.thread.map((p) => p.item)).toEqual([root.post, middle.post, leaf.post]);
      expect(restored.context[0].replyCount).toBe(2);
      expect(
        (await ok("/threads/summaries", { conversations: [root.conversation] })).conversations[0]
          .post.preview?.title,
      ).toBe("Removed discussion");
      expect((await ok("/subscriptions/mine", {}, reader)).subscriptions[0].target).toBe(
        root.conversation,
      );
      expect((await ok("/bookmarks/list", {}, reader)).bookmarks[0].item).toBe(leaf.post);
      expect(await forumMailEligibility(edge.application)(mail!)).toBe(true);
      expect(await call("/posts/delete", { post: root.post })).toEqual(conflict);

      // A separately trashed reply keeps its own marker through a thread trash and restore.
      await ok("/trash/trash", { item: middle.post }, moderator);
      await ok("/trash/trash", { item: root.conversation }, moderator);
      await assertHidden();
      expect((await ok("/trash/list", {}, moderator)).trashed.map((e) => e.item).sort()).toEqual(
        [middle.post, root.conversation].sort(),
      );
      await ok("/trash/restore", { item: root.conversation }, moderator);
      expect(
        (await ok("/threads/get", { conversation: root.conversation })).thread.map((p) => p.item),
      ).toEqual([root.post, leaf.post]);

      // Purging the thread purges every post, trashed or not, and dissolves the conversation.
      await ok("/trash/trash", { item: root.conversation }, moderator);
      await ok("/trash/purge", { item: root.conversation }, moderator);
      await edge.application.whenIdle();
      await assertHidden();
      expect(await call("/trash/restore", { item: root.conversation }, moderator)).toEqual(missing);
      expect(await call("/trash/restore", { item: middle.post }, moderator)).toEqual(missing);
      expect(await ok("/trash/list", {}, moderator)).toEqual({ trashed: [] });
      expect(await floor.Conversing._exists({ conversation: root.conversation })).toEqual({
        exists: false,
      });
      for (const post of [root.post, middle.post, leaf.post]) {
        expect(await floor.Posting._getPost({ post })).toEqual([]);
        expect(await floor.Trashing._isTrashed({ item: post })).toEqual({ trashed: false });
        expect(await call("/moderation/posts/get", { item: post }, moderator)).toEqual(missing);
      }
      expect(await floor.Subscribing._getSubscribers({ target: root.conversation })).toEqual([]);
      expect(await floor.Accessing._holders({ resource: root.conversation })).toEqual([]);
      expect(await floor.Revising._getRevisions({ item: leaf.post })).toEqual([]);
      // The other discussion is untouched.
      expect(
        (await ok("/threads/get", { conversation: other.conversation }, reader)).thread,
      ).toHaveLength(1);
    },
  );
}

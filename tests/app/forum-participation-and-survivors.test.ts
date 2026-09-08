import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
import { forumMailEligibility } from "../../src/email/forum-policy.ts";

afterAll(stopTestDb);
async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people = [];
  for (const username of ["author", "participant", "outsider"]) {
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email: `${username}@example.edu`,
    });
    const { session } = await instances.Sessioning.start({ user });
    await instances.Rostering.enrol({
      user,
      email: `${username}@example.edu`,
      kind: "STUDENT",
      section: null,
    });
    people.push({ user, session });
  }
  const app = assembleCommons(instances);
  const call = async (path: string, session: string, input: Record<string, unknown> = {}) => {
    const result = await app.invoker.invoke(path, { session, ...input });
    expect(result.ok, `${path}: ${JSON.stringify(result)}`).toBe(true);
    if (!result.ok) throw new Error(path);
    return result.value as Record<string, any>;
  };
  return { instances, app, people, call };
}

for (const kind of ["people", "staff", "group"]) {
  test(`${kind} participants follow later main-composer replies, respecting unfollow and access loss`, async () => {
    const {
      instances,
      app,
      people: [a, b],
      call,
    } = await fixture();
    let holders = [`account:${a.user}`, `account:${b.user}`];
    let group = "";
    if (kind === "staff") {
      const { role } = await instances.Roling.defineRole({
        name: "Staff",
        capabilities: ["grade"],
      });
      await instances.Roling.assign({ user: b.user, context: "commons", role });
      holders = [`account:${a.user}`, "standing:staff"];
    }
    if (kind === "group") {
      ({ group } = await instances.Grouping.create({
        creator: a.user,
        title: "Study group",
        at: new Date(),
      }));
      await instances.Grouping.addMember({
        group,
        member: a.user,
        candidate: b.user,
        at: new Date(),
      });
      holders = [`group:${group}`];
    }
    const root = await call("/threads/create", a.session, { content: "Opening", holders });
    await call("/threads/reply", b.session, { parent: root.node, content: "B answers" });
    expect(await instances.Subscribing._getSubscribers({ target: root.conversation })).toEqual([
      { user: a.user },
      { user: b.user },
    ]);
    const followup = await call("/threads/reply", a.session, {
      parent: root.node,
      content: "A follows up",
    });
    expect(await instances.Notifying._getInbox({ recipient: b.user })).toContainEqual(
      expect.objectContaining({ subject: followup.post, kind: "followed_reply" }),
    );
    const mail = (await instances.Mailing._getPending({})).find(
      (mail) => mail.recipient === "participant@example.edu" && mail.key.includes(followup.post),
    );
    expect(mail).toBeDefined();
    expect(await forumMailEligibility(app)(mail!)).toBe(true);
    await call("/subscriptions/unsubscribe", b.session, { target: root.conversation });
    await call("/threads/get", b.session, { conversation: root.conversation });
    const quiet = await call("/threads/reply", a.session, {
      parent: root.node,
      content: "After unfollow",
    });
    expect(await instances.Notifying._getInbox({ recipient: b.user })).not.toContainEqual(
      expect.objectContaining({ subject: quiet.post }),
    );
    expect(
      await instances.Subscribing._isSubscribed({ user: b.user, target: root.conversation }),
    ).toEqual({ subscribed: false });
    await call("/threads/reply", b.session, { parent: root.node, content: "B participates again" });
    expect(
      await instances.Subscribing._isSubscribed({ user: b.user, target: root.conversation }),
    ).toEqual({ subscribed: true });
    if (kind === "group") await instances.Grouping.leave({ group, member: b.user, at: new Date() });
    else await instances.Archiving.trash({ item: b.user, by: a.user, at: new Date() });
    const denied = await call("/threads/reply", a.session, {
      parent: root.node,
      content: "After access loss",
    });
    expect(await instances.Notifying._getInbox({ recipient: b.user })).not.toContainEqual(
      expect.objectContaining({ subject: denied.post }),
    );
    expect(await forumMailEligibility(app)(mail!)).toBe(false);
  });
}

test("trash, restore and purge retain authorized context and nested replies without unavailable post metadata", async () => {
  const {
    instances,
    app,
    people: [a, b, outsider],
    call,
  } = await fixture();
  const { role } = await instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  await instances.Roling.assign({ user: a.user, context: "commons", role });
  const root = await call("/threads/create", a.session, {
    content: "SECRET opening",
    holders: [`account:${a.user}`, `account:${b.user}`],
  });
  const middle = await call("/threads/reply", b.session, {
    parent: root.node,
    content: "SECRET intermediate",
  });
  const leaf = await call("/threads/reply", a.session, {
    parent: middle.node,
    content: "Surviving reply",
  });
  await call("/trash/trash", a.session, { item: root.post });
  await call("/trash/trash", a.session, { item: middle.post });
  for (const purged of [false, true]) {
    if (purged) {
      await call("/trash/restore", a.session, { item: root.post });
      expect(
        JSON.stringify(await call("/threads/get", b.session, { conversation: root.conversation })),
      ).toContain("SECRET opening");
      await call("/trash/trash", a.session, { item: root.post });
      await call("/trash/purge", a.session, { item: root.post });
      await call("/trash/purge", a.session, { item: middle.post });
    }
    const thread = await call("/threads/get", b.session, { conversation: root.conversation });
    expect(thread.thread).toHaveLength(1);
    expect(thread.context).toHaveLength(1);
    expect(thread.context[0]).toMatchObject({
      root: root.node,
      item: root.post,
      replyCount: 1,
      category: null,
      tags: [],
    });
    expect(thread.context[0].structure).toContainEqual(
      expect.objectContaining({ node: leaf.node, parent: middle.node }),
    );
    expect(JSON.stringify(thread)).not.toContain("SECRET");
    const feed = await call("/threads/activity", b.session);
    expect(feed.conversations).toContainEqual(
      expect.objectContaining({
        conversation: root.conversation,
        post: { author: null, content: null, createdAt: null, editedAt: null },
        replyCount: 1,
      }),
    );
    expect(await call("/subscriptions/mine", b.session)).toMatchObject({
      subscriptions: [expect.objectContaining({ target: root.conversation })],
    });
    expect(await call("/threads/forItem", b.session, { item: leaf.post })).toEqual({
      conversation: root.conversation,
    });
    expect(
      await app.invoker.invoke("/threads/get", {
        session: outsider.session,
        conversation: root.conversation,
      }),
    ).toEqual(
      await app.invoker.invoke("/threads/get", {
        session: outsider.session,
        conversation: "absent",
      }),
    );
  }
  await call("/trash/trash", a.session, { item: leaf.post });
  await call("/trash/purge", a.session, { item: leaf.post });
  expect(
    await app.invoker.invoke("/threads/get", {
      session: b.session,
      conversation: root.conversation,
    }),
  ).toMatchObject({ ok: false });
});

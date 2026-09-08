import { createEdge } from "../../src/edge.ts";
import { afterAll, afterEach, expect, test } from "vite-plus/test";
import { assemble } from "@mit-sdg/sync-engine/assembly";
import { former, where } from "@mit-sdg/sync-engine/language";
import type { Db } from "mongodb";
import { learningConcepts, mongoImplementations } from "../../src/concepts.ts";
import * as policy from "../../src/compositions/forum/audience-policy.ts";
import { testDb, stopTestDb } from "../../src/concepts/testing.ts";
const databases = new Set<Db>();
afterEach(async () => {
  await Promise.all([...databases].map((db) => db.dropDatabase()));
  databases.clear();
});
afterAll(stopTestDb);
const admission = former(
  "the production reader of (conversation) through (session)",
  ({ conversation, session }, { user }) =>
    where(
      policy.forumReader({ session }).is({ user }),
      policy.conversationReader({ user, conversation }),
    ).form({ user }),
).optional();
const fullAddressing = former(
  "the complete production selection (holders) through (session)",
  ({ holders, session }, { user }) =>
    where(
      policy.forumReader({ session }).is({ user }),
      policy.addressedAudience({ user, holders }),
    ).form({ user }),
).optional();
const addressing = former(
  "the production addressing of (recipient) through (session)",
  ({ recipient, session }, { user }) =>
    where(
      policy.forumReader({ session }).is({ user }),
      policy.addressableAccount({ user, recipient }),
    ).form({ user }),
).optional();
async function fixture(holders: (people: { user: string; session: string }[]) => string[]) {
  const db = await testDb();
  databases.add(db);
  const instances = mongoImplementations(db);
  const people = await Promise.all(
    ["amara", "mira", "outsider"].map(async (username) => {
      const { user } = await instances.Authenticating.register({
        username,
        password: "test-password",
        email: `${username}@example.edu`,
      });
      const { session } = await instances.Sessioning.start({ user });
      await instances.Rostering.enrol({
        user,
        email: `${username}@example.edu`,
        kind: "STUDENT",
        section: null,
      });
      return { user, session };
    }),
  );
  const { post } = await instances.Posting.create({
    author: people[0].user,
    content: "private",
    at: new Date(),
  });
  const { node, conversation } = await instances.Conversing.start({
    item: post,
    at: new Date(),
  });
  await instances.Accessing.establish({ resource: conversation, holders: holders(people) });
  const app = assemble({
    conceptSet: learningConcepts,
    instances,
    composition: { policy, admission, addressing, fullAddressing },
    queryCache: "none",
  });
  return { db, instances, people, post, node, conversation, app };
}
test("production policy preserves direct access after departure, but closes new addressing and all access after archival", async () => {
  const f = await fixture((people) => [`account:${people[1].user}`]);
  const [author, reader] = f.people;
  expect(
    await f.app.form(admission({ session: author.session, conversation: f.conversation })),
  ).toBeNull();
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toEqual({ user: reader.user });
  const [{ seat }] = await f.instances.Rostering._getSeatByUser({ user: reader.user });
  await f.instances.Rostering.dropSeat({ seat });
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toEqual({ user: reader.user });
  expect(
    await f.app.form(addressing({ session: author.session, recipient: reader.user })),
  ).toBeNull();
  await f.instances.Archiving.trash({ item: reader.user, by: author.user, at: new Date() });
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toBeNull();
});
test("production Staff classification excludes moderate and changes with the current capability", async () => {
  const f = await fixture(() => ["standing:staff"]);
  const reader = f.people[1];
  const { role } = await f.instances.Roling.defineRole({
    name: "Moderator",
    capabilities: ["moderate"],
  });
  await f.instances.Roling.assign({ user: reader.user, context: "commons", role });
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toBeNull();
  await f.instances.Roling.revoke({ user: reader.user, context: "commons" });
  const { role: teacher } = await f.instances.Roling.defineRole({
    name: "Teacher",
    capabilities: ["grade"],
  });
  await f.instances.Roling.assign({ user: reader.user, context: "commons", role: teacher });
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toEqual({ user: reader.user });
  await f.instances.Roling.revoke({ user: reader.user, context: "commons" });
  expect(
    await f.app.form(admission({ session: reader.session, conversation: f.conversation })),
  ).toBeNull();
});
test("production conversation admission survives root content removal and has no missing-grant fallback", async () => {
  const f = await fixture((people) => [`account:${people[1].user}`]);
  const { post } = await f.instances.Posting.create({
    author: f.people[1].user,
    content: "reply",
    at: new Date(),
  });
  await f.instances.Conversing.reply({ item: post, parent: f.node, at: new Date() });
  await f.instances.Posting.delete({ post: f.post });
  expect(
    await f.app.form(admission({ session: f.people[1].session, conversation: f.conversation })),
  ).toEqual({ user: f.people[1].user });
  await f.instances.Accessing.retire({ resource: f.conversation });
  expect(
    await f.app.form(admission({ session: f.people[1].session, conversation: f.conversation })),
  ).toBeNull();
});

test("the production options and full selection agree on people, groups, sections and Staff-only Students", async () => {
  const f = await fixture((people) => [`account:${people[1].user}`]);
  const author = f.people[0];
  const reader = f.people[1];
  const { group } = await f.instances.Grouping.create({
    title: "Study",
    creator: author.user,
    at: new Date(),
  });
  const { section } = await f.instances.Rostering.createSection({
    name: "A",
    location: "",
    meetingPattern: "",
  });
  const [{ seat }] = await f.instances.Rostering._getSeatByUser({ user: author.user });
  await f.instances.Rostering.moveSection({ seat, section: section._id });
  const edge = createEdge(f.instances);
  const options = await edge.application.invoker.invoke("/audiences/options", {
    session: author.session,
  });
  expect(options).toMatchObject({
    ok: true,
    value: {
      holders: expect.arrayContaining([
        { holder: `group:${group}`, kind: "group", identity: group, label: "Study" },
        { holder: `section:${section._id}`, kind: "section", identity: section._id, label: "A" },
        { holder: "standing:staff", kind: "standing", identity: "staff", label: "Staff" },
      ]),
    },
  });
  expect(JSON.stringify(options)).not.toContain("standing:students");
  for (const holders of [
    [`account:${author.user}`, `account:${reader.user}`],
    [`group:${group}`],
    [`section:${section._id}`],
    ["standing:everyone"],
    [`account:${author.user}`, "standing:staff"],
  ]) {
    expect(await f.app.form(fullAddressing({ session: author.session, holders }))).toEqual({
      user: author.user,
    });
  }
  for (const holders of [
    [`account:${reader.user}`],
    ["standing:students"],
    ["group:unknown"],
    ["standing:staff"],
    ["standing:everyone", "standing:everyone"],
  ]) {
    expect(await f.app.form(fullAddressing({ session: author.session, holders }))).toBeNull();
  }
  const { role } = await f.instances.Roling.defineRole({ name: "Staff", capabilities: ["grade"] });
  await f.instances.Roling.assign({ user: author.user, context: "commons", role });
  expect(
    await f.app.form(
      fullAddressing({
        session: author.session,
        holders: ["standing:students", `account:${author.user}`],
      }),
    ),
  ).toEqual({ user: author.user });
});
test("production audience presentation hides unknown and inaccessible holders and ignores a supplied actor", async () => {
  const f = await fixture((people) => [`account:${people[1].user}`]);
  const edge = createEdge(f.instances);
  const hidden = await edge.application.invoker.invoke("/audiences/forConversation", {
    session: f.people[0].session,
    conversation: f.conversation,
    user: f.people[1].user,
  });
  const missing = await edge.application.invoker.invoke("/audiences/forConversation", {
    session: f.people[0].session,
    conversation: "unknown",
  });
  expect(hidden).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
  expect(missing).toMatchObject({ ok: false, error: { kind: "domain", value: "NOT_FOUND" } });
  expect(
    await edge.application.invoker.invoke("/audiences/forConversation", {
      session: f.people[1].session,
      conversation: f.conversation,
    }),
  ).toMatchObject({
    ok: true,
    value: { holders: [{ holder: `account:${f.people[1].user}`, label: "mira" }] },
  });
});

test("bounded production membership preserves the union across current group and section changes", async () => {
  const f = await fixture((people) => [`account:${people[0].user}`]);
  const [author, reader] = f.people;
  const at = new Date();
  const { group } = await f.instances.Grouping.create({ title: "Study", creator: author.user, at });
  await f.instances.Grouping.addMember({ group, member: author.user, candidate: reader.user, at });
  const { section } = await f.instances.Rostering.createSection({
    name: "A",
    location: "",
    meetingPattern: "",
  });
  const [{ seat }] = await f.instances.Rostering._getSeatByUser({ user: reader.user });
  await f.instances.Rostering.moveSection({ seat, section: section._id });
  const { post } = await f.instances.Posting.create({ author: author.user, content: "Union", at });
  const { conversation } = await f.instances.Conversing.start({ item: post, at });
  await f.instances.Accessing.establish({
    resource: conversation,
    holders: [`group:${group}`, "group:missing", `section:${section._id}`],
  });
  const read = () => f.app.form(admission({ session: reader.session, conversation }));
  expect(await read()).toEqual({ user: reader.user });
  await f.instances.Rostering.dropSeat({ seat });
  expect(await read()).toEqual({ user: reader.user });
  await f.instances.Grouping.leave({ group, member: reader.user, at });
  expect(await read()).toBeNull();
});

test("audience preview includes the sender for people and otherwise-unreadable collectives", async () => {
  const f = await fixture(() => ["standing:everyone"]);
  const [author, recipient] = f.people;
  const app = createEdge(f.instances).application;
  for (const [selected, expected] of [
    [[`account:${recipient.user}`], [`account:${recipient.user}`, `account:${author.user}`]],
    [["standing:staff"], ["standing:staff", `account:${author.user}`]],
    [["standing:everyone"], ["standing:everyone"]],
  ]) {
    const result = await app.invoker.invoke("/audiences/preview", {
      session: author.session,
      holders: selected,
    });
    expect(result).toMatchObject({ ok: true, value: { holders: [...expected].sort() } });
    if (!result.ok) throw new Error("Preview refused");
    expect(
      await f.app.form(
        fullAddressing({
          session: author.session,
          holders: (result.value as { holders: string[] }).holders,
        }),
      ),
    ).toEqual({ user: author.user });
  }
});

test("audience preview keeps a current group collective and refuses a withdrawn or invalid selection", async () => {
  const f = await fixture(() => ["standing:everyone"]);
  const author = f.people[0];
  const { group } = await f.instances.Grouping.create({
    title: "Study",
    creator: author.user,
    at: new Date(),
  });
  const app = createEdge(f.instances).application;
  const input = { session: author.session, holders: [`group:${group}`] };
  expect(await app.invoker.invoke("/audiences/preview", input)).toMatchObject({
    ok: true,
    value: { holders: input.holders },
  });
  await f.instances.Grouping.addMember({
    group,
    member: author.user,
    candidate: f.people[1].user,
    at: new Date(),
  });
  await f.instances.Grouping.leave({ group, member: author.user, at: new Date() });
  for (const holders of [
    input.holders,
    ["account:unknown"],
    ["standing:students"],
    ["standing:unknown"],
    ["standing:everyone", "standing:everyone"],
    [],
  ])
    expect(
      await app.invoker.invoke("/audiences/preview", { session: author.session, holders }),
    ).toMatchObject({ ok: false });
  expect(
    await app.invoker.invoke("/audiences/preview", {
      session: author.session,
      holders: ["standing:everyone"],
      user: f.people[1].user,
    }),
  ).toMatchObject({ ok: false });
});

test("Staff preview includes the sender for another section without altering publication admission", async () => {
  const f = await fixture(() => ["standing:everyone"]);
  const author = f.people[0];
  const { role } = await f.instances.Roling.defineRole({ name: "Staff", capabilities: ["grade"] });
  await f.instances.Roling.assign({ user: author.user, context: "commons", role });
  const { section } = await f.instances.Rostering.createSection({
    name: "Other",
    location: "",
    meetingPattern: "",
  });
  const selected = [`section:${section._id}`];
  const app = createEdge(f.instances).application;
  expect(
    await app.invoker.invoke("/audiences/preview", { session: author.session, holders: selected }),
  ).toMatchObject({ ok: true, value: { holders: [`account:${author.user}`, ...selected].sort() } });
  expect(
    await f.app.form(fullAddressing({ session: author.session, holders: selected })),
  ).toBeNull();
});

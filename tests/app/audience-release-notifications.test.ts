import { afterAll, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { theMailEligibility } from "../../src/compositions/forum/notifications.ts";

afterAll(stopTestDb);

async function fixture() {
  const instances = mongoImplementations(await testDb());
  const people = [];
  for (const username of ["student", "admin", "tutor", "other"]) {
    const { user } = await instances.Authenticating.register({
      username,
      password: "long-password",
      email: `${username}@example.edu`,
    });
    const { session } = await instances.Sessioning.start({ user });
    const { seat } = await instances.Rostering.enrol({
      user,
      email: `${username}@example.edu`,
      kind: username === "student" || username === "other" ? "STUDENT" : "STAFF",
      section: null,
    });
    people.push({ user, session, seat: seat._id, email: `${username}@example.edu` });
  }
  for (const [index, capability] of [
    [1, "administer"],
    [2, "grade"],
  ] as const) {
    const { role } = await instances.Roling.defineRole({
      name: capability,
      capabilities: [capability],
    });
    await instances.Roling.assign({ user: people[index].user, context: "commons", role });
  }
  return { app: assembleCommons(instances), people };
}

type App = Awaited<ReturnType<typeof fixture>>["app"];
async function invoke(app: App, path: string, body: Record<string, unknown>) {
  const result = await app.invoker.invoke(path as never, body as never);
  await app.whenIdle();
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.value as Record<string, any>;
}

test("private Staff openings notify current staff once, excluding author and course-wide posts", async () => {
  const {
    app,
    people: [student, admin, ta, other],
  } = await fixture();
  const created = await invoke(app, "/threads/create", {
    session: student.session,
    content: "Private question @tutor",
    holders: [`account:${student.user}`, "standing:staff", `account:${admin.user}`],
  });
  const inbox = async (session: string) =>
    (await invoke(app, "/notifications/inbox", { session })).notifications;
  expect(await inbox(admin.session)).toEqual([
    expect.objectContaining({ kind: "staff_message", link: created.post }),
  ]);
  expect(await inbox(ta.session)).toEqual([
    expect.objectContaining({ kind: "mention", link: created.post }),
  ]);
  expect(await inbox(student.session)).toEqual([]);
  expect(await inbox(other.session)).toEqual([]);
  const staffMail = await app.concepts.Mailing._getPending({});
  expect(staffMail).toHaveLength(2);
  for (const mail of staffMail) {
    expect(mail.text).toContain("Author: @student");
    expect(mail.text).toContain("Private question @tutor");
  }
  await invoke(app, "/threads/create", {
    session: student.session,
    content: "Public",
    holders: ["standing:everyone", "standing:staff"],
  });
  expect(await inbox(admin.session)).toHaveLength(1);
  await app.concepts.Roling.revoke({ user: ta.user, context: "commons" });
  expect(await inbox(ta.session)).toEqual([]);
  expect(await invoke(app, "/notifications/unreadCount", { session: ta.session })).toEqual({
    count: 0,
  });
  expect(
    await app.form(
      theMailEligibility({ recipient: ta.user, post: created.post, queued: ta.email }),
    ),
  ).toBeNull();
});

test("assignment release notifications target actual assignees and disappear when access is lost", async () => {
  const {
    app,
    people: [student, admin, , other],
  } = await fixture();
  const draft = await invoke(app, "/assignments/create-draft", {
    session: admin.session,
    title: "New exercise",
    instructions: "Private instructions",
    kind: "HOMEWORK",
    availableAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    audience: "EVERYONE",
    acceptsSubmissions: true,
  });
  const inbox = async (session: string) =>
    (await invoke(app, "/notifications/inbox", { session })).notifications;
  expect(await inbox(student.session)).toEqual([]);
  await invoke(app, "/assignments/publish", {
    session: admin.session,
    assignment: draft.assignment,
  });
  const rows = await inbox(student.session);
  const mail = (await app.concepts.Mailing._getPending({})).find(
    (m) => m.recipient === student.email,
  );
  expect(mail?.subject).toBe("A new assignment is available: New exercise");
  expect(mail?.text).toContain(`/assignments/${draft.assignment}`);
  expect(`${mail?.text}${mail?.html}`).not.toContain("Private instructions");
  expect(mail?.text).not.toContain("Author:");
  expect(
    await invoke(app, "/mail/read", { session: admin.session, message: mail!.message }),
  ).toMatchObject({
    text: expect.stringContaining("Assignment: New exercise"),
  });
  expect(rows).toEqual([
    expect.objectContaining({
      kind: "assignment_released",
      link: draft.assignment,
      assignmentTitle: "New exercise",
      read: false,
    }),
  ]);
  expect(await inbox(other.session)).toHaveLength(1);
  expect(await inbox(admin.session)).toEqual([]);
  expect(await invoke(app, "/notifications/unreadCount", { session: student.session })).toEqual({
    count: 1,
  });
  await invoke(app, "/notifications/markRead", {
    session: student.session,
    notification: rows[0].notification,
  });
  expect(await invoke(app, "/notifications/unreadCount", { session: student.session })).toEqual({
    count: 0,
  });
  expect(await app.concepts.Mailing._getPending({})).toHaveLength(2);
  await expect(
    app.concepts.Assigning.assign({
      assignment: draft.assignment,
      assignee: student.user,
      at: new Date(),
    }),
  ).resolves.toMatchObject({ error: "RELEASE_ALREADY_EXISTS" });
  expect(await inbox(student.session)).toHaveLength(1);
  await app.concepts.Rostering.dropSeat({ seat: student.seat });
  expect(await inbox(student.session)).toEqual([]);
  expect(
    await app.form(
      theMailEligibility({
        recipient: student.user,
        post: draft.assignment,
        queued: student.email,
      }),
    ),
  ).toBeNull();
  await invoke(app, "/assignments/archive", {
    session: admin.session,
    assignment: draft.assignment,
  });
  expect(await inbox(other.session)).toEqual([]);
});

test("targeted releases notify only students in the selected section", async () => {
  const {
    app,
    people: [student, admin, , other],
  } = await fixture();
  const { section } = await app.concepts.Rostering.createSection({
    name: "Section A",
    location: "",
    meetingPattern: "",
  });
  await app.concepts.Rostering.moveSection({ seat: student.seat, section: section._id });
  const draft = await invoke(app, "/assignments/create-draft", {
    session: admin.session,
    title: "Section exercise",
    instructions: "",
    kind: "HOMEWORK",
    availableAt: new Date().toISOString(),
    dueAt: new Date(Date.now() + 86400000).toISOString(),
    audience: "TARGETS",
    targets: [section._id],
    acceptsSubmissions: true,
  });
  await invoke(app, "/assignments/publish", {
    session: admin.session,
    assignment: draft.assignment,
  });
  const rows = (await invoke(app, "/notifications/inbox", { session: student.session }))
    .notifications;
  expect(rows).toHaveLength(1);
  expect(
    (await invoke(app, "/notifications/inbox", { session: other.session })).notifications,
  ).toEqual([]);
  expect(
    await app.invoker.invoke("/notifications/markRead", {
      session: other.session,
      notification: rows[0].notification,
    }),
  ).toMatchObject({ ok: false });
  expect(await app.concepts.Mailing._getPending({})).toHaveLength(1);
});

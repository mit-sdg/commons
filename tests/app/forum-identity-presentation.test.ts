import { describe, expect, test } from "vite-plus/test";
import { assembleCommons } from "../../src/assembly/application.ts";
import { theInboxOf } from "../../src/compositions/forum/notifications.ts";
import { theTargetsTaggedWithName } from "../../src/compositions/forum/tags.ts";

async function send(
  app: ReturnType<typeof assembleCommons>,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await app.invoker.invoke(path, body as never, { timeoutMs: 2000 });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`request to ${path} failed`);
  return result.value as Record<string, unknown>;
}

describe("forum identity and lookup presentation", () => {
  test("a tag name resolves to its tag before its targets are read", async () => {
    const app = assembleCommons();
    const { post } = await app.concepts.Posting.create({
      author: "author",
      content: "A tagged post",
      at: new Date("2026-07-19T12:00:00.000Z"),
    });
    const { tag } = await app.concepts.Tagging.createTag({ name: "design" });
    await app.concepts.Tagging.addTag({ target: post, tag });

    expect(await app.form(theTargetsTaggedWithName({ name: "design" }))).toEqual([
      { target: post },
    ]);
    expect(await send(app, "/tags/targetsByName", { name: "design" })).toEqual({
      targets: [{ target: post }],
    });
    expect(await send(app, "/tags/targets", { tag })).toEqual({
      targets: [{ target: post }],
    });
    expect(await send(app, "/tags/targetsByName", { name: "missing" })).toEqual({
      targets: [],
    });
  });

  test("the notification inbox presents the actor's profile name and keeps the user id", async () => {
    const app = assembleCommons();
    const { user: actor } = await app.concepts.Authenticating.register({
      username: "mara",
      password: "long-enough-secret",
      email: "mara@example.edu",
    });
    await app.concepts.Profiling.createProfile({
      user: actor,
      displayName: "Mara",
      email: "mara@example.edu",
    });
    const { user: recipient } = await app.concepts.Authenticating.register({
      username: "noah",
      password: "long-enough-secret",
      email: "noah@example.edu",
    });
    const at = new Date("2026-07-16T12:00:00.000Z");
    const { post } = await app.concepts.Posting.create({
      author: actor,
      content: "A named reply",
      at,
    });
    const { notification } = await app.concepts.Notifying.notify({
      recipient,
      kind: "reply",
      subject: post,
      link: post,
      at,
    });

    expect(await app.form(theInboxOf({ user: recipient }))).toEqual([
      {
        notification: expect.any(String),
        kind: "reply",
        link: post,
        createdAt: at,
        read: false,
        post: { author: actor, content: "A named reply", createdAt: at, editedAt: null },
        actor: { user: actor, username: "mara", displayName: "Mara", avatar: "" },
      },
    ]);

    const { session } = await app.concepts.Sessioning.start({ user: recipient });
    expect(await send(app, "/notifications/list", { session })).toEqual({
      notifications: [
        { notification, kind: "reply", subject: post, link: post, createdAt: at, read: false },
      ],
    });
    const inbox = await send(app, "/notifications/inbox", { session });
    expect(inbox.notifications).toEqual([
      expect.objectContaining({
        notification,
        actor: { user: actor, username: "mara", displayName: "Mara", avatar: "" },
      }),
    ]);

    await app.concepts.Profiling.setDisplayName({ user: actor, displayName: "Mara V." });
    const [afterRename] = (await app.form(theInboxOf({ user: recipient }))) as {
      actor: { user: string; username: string; displayName: string };
    }[];
    expect(afterRename.actor).toMatchObject({
      user: actor,
      username: "mara",
      displayName: "Mara V.",
    });
  });

  test("public user denotation resolves without a session and returns no match for ambiguous or unknown names", async () => {
    const app = assembleCommons();
    const { user: titleCase } = await app.concepts.Authenticating.register({
      username: "Elena",
      password: "long-enough-secret",
      email: "title@example.edu",
    });

    expect(await send(app, "/users/resolve", { ref: "elena" })).toEqual({
      user: titleCase,
      username: "Elena",
    });
    expect(await send(app, "/users/resolve", { ref: titleCase })).toEqual({
      user: titleCase,
      username: "Elena",
    });

    await app.concepts.Authenticating.register({
      username: "elena",
      password: "long-enough-secret",
      email: "lower@example.edu",
    });
    expect(await send(app, "/users/resolve", { ref: "Elena" })).toEqual({
      user: titleCase,
      username: "Elena",
    });
    expect(await send(app, "/users/resolve", { ref: "ELENA" })).toEqual({
      user: null,
      username: null,
    });
    expect(await send(app, "/users/resolve", { ref: "nobody" })).toEqual({
      user: null,
      username: null,
    });
  });
});

import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";

async function actor(app: ReturnType<typeof assembleCommons>, username: string) {
  const registered = await app.concepts.Authenticating.register({
    username,
    password: "password123",
    email: `${username}@example.edu`,
  });
  await app.concepts.Profiling.createProfile({
    user: registered.user,
    displayName: username,
    email: `${username}@example.edu`,
  });
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!login.ok) throw new Error(`could not create ${username}`);
  return (login.value as { session: string }).session;
}

function publicResult(
  result: Awaited<ReturnType<ReturnType<typeof assembleCommons>["invoker"]["invoke"]>>,
) {
  return result.ok
    ? result.value
    : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
}

async function expectOneAnswer(
  app: ReturnType<typeof assembleCommons>,
  path: string,
  body: Record<string, unknown>,
  expected: unknown,
  expectedBy?: string,
) {
  const before = inspectAssembly(app).occurrences.length;
  const result = await app.invoker.invoke(path as never, body as never);
  expect(publicResult(result)).toEqual(expected);
  await new Promise((resolve) => setTimeout(resolve, 20));
  const responses = inspectAssembly(app)
    .occurrences.slice(before)
    .filter((event) => event.concept === "RequestBoundary" && event.action === "respond");
  expect(responses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
  expect(responses.filter((event) => event.outcome?.kind === "error")).toHaveLength(0);
  if (expectedBy !== undefined) {
    expect(responses.find((event) => event.outcome?.kind === "result")?.by).toBe(expectedBy);
  }
}

describe("boundary partitions", () => {
  test("thread replies choose one open, locked, or missing-parent answer", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const session = await actor(app, "thread_partition");
    const created = await app.invoker.invoke("/threads/create", {
      session,
      content: "Question",
    } as never);
    if (!created.ok) throw new Error("could not create thread");
    const thread = created.value as { conversation: string; node: string };

    const beforeReply = inspectAssembly(app).occurrences.length;
    const reply = await app.invoker.invoke("/threads/reply", {
      session,
      parent: thread.node,
      content: "Answer",
    } as never);
    expect(reply.ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const replyResponses = inspectAssembly(app)
      .occurrences.slice(beforeReply)
      .filter((event) => event.concept === "RequestBoundary" && event.action === "respond");
    expect(replyResponses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
    expect(replyResponses.filter((event) => event.outcome?.kind === "error")).toHaveLength(0);

    await app.concepts.Locking.lock({ target: thread.conversation, at: new Date() });
    await expectOneAnswer(
      app,
      "/threads/reply",
      { session, parent: thread.node, content: "Too late" },
      { error: "FORBIDDEN" },
    );
    await expectOneAnswer(
      app,
      "/threads/reply",
      { session, parent: "missing-node", content: "Nowhere" },
      { error: "PARENT_NODE_NOT_FOUND" },
    );
  });

  test("resolution acceptance names its success, policy, and absence paths", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const authorSession = await actor(app, "resolution_author");
    const otherSession = await actor(app, "resolution_other");
    const created = await app.invoker.invoke("/threads/create", {
      session: authorSession,
      content: "Question",
    } as never);
    if (!created.ok) throw new Error("could not create resolution question");
    const question = created.value as { node: string; post: string };
    const replied = await app.invoker.invoke("/threads/reply", {
      session: authorSession,
      parent: question.node,
      content: "Answer",
    } as never);
    if (!replied.ok) throw new Error("could not create resolution answer");
    const answer = replied.value as { post: string };

    await expectOneAnswer(
      app,
      "/resolutions/accept",
      { session: otherSession, question: question.post, answer: answer.post },
      { error: "FORBIDDEN" },
      "Forum.resolutions.AcceptAnswer:not-author",
    );
    await expectOneAnswer(
      app,
      "/resolutions/accept",
      { session: authorSession, question: "missing-question", answer: "missing-answer" },
      { error: "NOT_FOUND" },
      "Forum.resolutions.AcceptAnswer:hidden-question",
    );
    await expectOneAnswer(
      app,
      "/resolutions/accept",
      { session: authorSession, question: question.post, answer: "missing-answer" },
      { error: "NOT_FOUND" },
      "Forum.resolutions.AcceptAnswer:hidden-answer",
    );
    await expectOneAnswer(
      app,
      "/resolutions/accept",
      { session: authorSession, question: question.post, answer: answer.post },
      expect.objectContaining({ resolution: expect.any(String) }),
      "Forum.resolutions.AcceptAnswer:accepted#2",
    );
  });

  test("overlapping profile absence paths both fire without gaining priority", async () => {
    const app = assembleCommons(mongoImplementations(await testDb()));
    const session = await actor(app, "profile_overlap");
    const before = inspectAssembly(app).occurrences.length;
    const result = await app.invoker.invoke("/profiles/get", {
      session,
      user: "missing-user",
    } as never);

    expect(publicResult(result)).toEqual({ error: "NOT_FOUND" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const responses = inspectAssembly(app)
      .occurrences.slice(before)
      .filter((event) => event.concept === "RequestBoundary" && event.action === "respond");
    expect(responses.filter((event) => event.outcome?.kind === "result")).toHaveLength(1);
    expect(responses.filter((event) => event.outcome?.kind === "error")).toHaveLength(1);
    expect(
      responses.map((event) => event.by).sort((left, right) => left!.localeCompare(right!)),
    ).toEqual(["Forum.profiles.GetProfile:hidden", "Forum.profiles.GetProfile:missing"]);
  });
});

afterAll(stopTestDb);

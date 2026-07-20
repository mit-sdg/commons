import { describe, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";

async function actor(app: ReturnType<typeof assembleCommons>, username: string) {
  const registered = await app.invoker.invoke("/auth/register", {
    username,
    password: "password123",
    displayName: username,
    email: `${username}@example.edu`,
  } as never);
  const login = await app.invoker.invoke("/auth/login", {
    username,
    password: "password123",
  } as never);
  if (!registered.ok || !login.ok) throw new Error(`could not create ${username}`);
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
}

describe("boundary partitions", () => {
  test("thread replies choose one open, locked, or missing-parent answer", async () => {
    const app = assembleCommons();
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

  test("a missing resolution question produces one not-found answer", async () => {
    const app = assembleCommons();
    const session = await actor(app, "resolution_partition");
    await expectOneAnswer(
      app,
      "/resolutions/accept",
      { session, question: "missing-question", answer: "missing-answer" },
      { error: "NOT_FOUND" },
    );
  });
});

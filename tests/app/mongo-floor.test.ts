import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { MongoPostingConcept } from "../../src/concepts/posting/posting.mongo.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { assembleCommons } from "../../src/assembly/application.ts";

afterAll(stopTestDb);

async function mongoApp() {
  const app = assembleCommons({
    ...mongoImplementations(await testDb()),
    Posting: new MongoPostingConcept(await testDb()),
  });
  const send = async (path: string, body: Record<string, unknown>) => {
    const result = await app.invoker.invoke(path, body as never);
    return result.ok
      ? (result.value as Record<string, unknown>)
      : { error: result.error.kind === "domain" ? result.error.value : result.error.code };
  };
  return { app, send };
}

describe("Commons with Posting on MongoDB", () => {
  test("a thread is created, replied to, and read back with all posts", async () => {
    const { app, send } = await mongoApp();
    const registered = await app.concepts.Authenticating.register({
      username: "amara",
      password: "password123",
      email: "amara@example.com",
    });
    await app.concepts.Profiling.createProfile({
      user: registered.user,
      displayName: "Amara",
      email: "amara@example.com",
    });
    const { session } = (await send("/auth/login", {
      username: "amara",
      password: "password123",
    })) as { session: string };

    const thread = await send("/threads/create", { session, content: "Hello from Mongo" });
    expect(thread.post).toBeDefined();
    expect(thread.conversation).toBeDefined();

    const reply = await send("/threads/reply", {
      session,
      parent: thread.node,
      content: "A reply that mentions [[somewhere]]",
    });
    expect(reply.post).toBeDefined();

    const got = (await send("/threads/get", { conversation: thread.conversation })) as {
      thread: { item: string; post: { content: string }; rendered: string }[];
    };
    expect(got.thread).toHaveLength(2);
    expect(got.thread[0].post.content).toBe("Hello from Mongo");
    expect(got.thread[1].post.content).toBe("A reply that mentions [[somewhere]]");
    expect(got.thread[0].rendered).toContain("Hello from Mongo");
  });

  test("an edit re-renders while a stranger receives FORBIDDEN", async () => {
    const { app, send } = await mongoApp();
    for (const username of ["ada", "eve"]) {
      const registered = await app.concepts.Authenticating.register({
        username,
        password: "password123",
        email: `${username}@example.com`,
      });
      await app.concepts.Profiling.createProfile({
        user: registered.user,
        displayName: username,
        email: `${username}@example.com`,
      });
    }
    const { session: ada } = (await send("/auth/login", {
      username: "ada",
      password: "password123",
    })) as { session: string };
    const { session: eve } = (await send("/auth/login", {
      username: "eve",
      password: "password123",
    })) as { session: string };

    const thread = await send("/threads/create", { session: ada, content: "before" });
    const denied = await send("/posts/edit", {
      session: eve,
      post: thread.post,
      content: "hijacked",
    });
    expect(denied).toEqual({ error: "FORBIDDEN" });

    const edited = await send("/posts/edit", { session: ada, post: thread.post, content: "after" });
    expect(edited.post).toBeDefined();
    const got = (await send("/posts/get", { post: thread.post })) as {
      post: { content: string };
    };
    expect(got.post.content).toBe("after");
  });
});

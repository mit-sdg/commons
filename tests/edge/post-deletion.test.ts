import { afterAll, expect, test } from "vite-plus/test";
import type { CommonsBrowserWire } from "../../src/client.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { createEdge } from "../../src/edge.ts";

const origin = "https://commons.test";
afterAll(stopTestDb);

test.each(["private", "everyone"] as const)(
  "%s posts with replies refuse deletion as a conflict, while authors can delete leaves",
  async (audience) => {
    const instances = mongoImplementations(await testDb());
    const [author, reader, outsider] = await Promise.all(
      ["author", "reader", "outsider"].map(async (username) => {
        const email = `${username}@example.edu`;
        const { user } = await instances.Authenticating.register({
          username,
          email,
          password: "test-password",
        });
        const { session } = await instances.Sessioning.start({ user });
        await instances.Rostering.enrol({ user, email, kind: "STUDENT", section: null });
        return { user, session };
      }),
    );
    const edge = createEdge(instances, origin);
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
    const created = await call("/threads/create", {
      content: "Opening post",
      holders:
        audience === "private"
          ? [`account:${author.user}`, `account:${reader.user}`]
          : ["standing:everyone"],
    });
    expect(created.status).toBe(200);
    const root = created.body as CommonsBrowserWire["/threads/create"]["output"];
    const replied = await call(
      "/threads/reply",
      { parent: root.node, content: "Another person's reply" },
      reader,
    );
    expect(replied.status).toBe(200);
    const reply = replied.body as CommonsBrowserWire["/threads/reply"]["output"];

    expect(await call("/posts/delete", { post: root.post })).toEqual({
      status: 409,
      body: { error: "CONFLICT" },
    });
    // Refusal preserves both the opening and the other person's reply.
    const thread = await call("/threads/get", { conversation: root.conversation });
    expect(thread.status).toBe(200);
    expect(thread.body.thread.map((node: { item: string }) => node.item)).toEqual([
      root.post,
      reply.post,
    ]);
    expect((await call("/posts/get", { post: root.post })).body.post.content).toBe("Opening post");
    expect((await call("/posts/get", { post: reply.post })).body.post.content).toBe(
      "Another person's reply",
    );

    // Neither authorship of the topic nor audience access grants ownership of a reply.
    expect(await call("/posts/delete", { post: reply.post })).toEqual({
      status: 403,
      body: { error: "FORBIDDEN" },
    });
    expect(await call("/posts/delete", { post: root.post }, reader)).toEqual({
      status: 403,
      body: { error: "FORBIDDEN" },
    });
    expect(await call("/posts/delete", { post: root.post }, outsider)).toEqual(
      audience === "private"
        ? { status: 404, body: { error: "NOT_FOUND" } }
        : { status: 403, body: { error: "FORBIDDEN" } },
    );

    expect(await call("/posts/delete", { post: reply.post }, reader)).toEqual({
      status: 200,
      body: { post: reply.post },
    });
    expect(await call("/posts/get", { post: reply.post })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    // Once its last reply is removed, the topic is a leaf and deletion succeeds.
    expect(await call("/posts/delete", { post: root.post })).toEqual({
      status: 200,
      body: { post: root.post },
    });
    expect(await call("/posts/get", { post: root.post })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
    expect(await call("/posts/delete", { post: root.post })).toEqual({
      status: 404,
      body: { error: "NOT_FOUND" },
    });
  },
);

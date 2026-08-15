import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { afterAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";

const post = (edge: ReturnType<typeof createEdge>, path: string, body: unknown) =>
  edge.fetch(
    new Request(`http://commons.test/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("thread listing routes", () => {
  test("latest and activity are separate protected routes with no sort dispatch", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    for (const path of ["/threads/latest", "/threads/activity"]) {
      const response = await post(edge, path, {});
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
    }

    const oldDispatch = await post(edge, "/threads/list", { sort: "latest" });
    expect(oldDispatch.status).toBe(404);
    expect(await oldDispatch.json()).toEqual({ error: "NOT_FOUND" });
  });

  test("the thread route requires authentication before returning context", async () => {
    const edge = createEdge(mongoImplementations(await testDb()));
    const response = await post(edge, "/threads/get", { conversation: "missing" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "UNAUTHORIZED" });
  });
});

afterAll(stopTestDb);

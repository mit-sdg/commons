import { describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";

const post = (edge: ReturnType<typeof createEdge>, path: string, body: unknown) =>
  edge.fetch(
    new Request(`http://commons.test${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("thread listing routes", () => {
  test("latest and activity are separate routes with no sort dispatch", async () => {
    const edge = createEdge();
    for (const path of ["/threads/latest", "/threads/activity"]) {
      const response = await post(edge, path, {});
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ conversations: [] });
    }

    const oldDispatch = await post(edge, "/threads/list", { sort: "latest" });
    expect(oldDispatch.status).toBe(404);
    expect(await oldDispatch.json()).toEqual({ error: "NOT_FOUND" });
  });

  test("the thread route returns its rows and page context together", async () => {
    const edge = createEdge();
    const response = await post(edge, "/threads/get", { conversation: "missing" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ thread: [], context: [] });
  });
});

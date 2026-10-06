import { expect, test } from "vite-plus/test";
import { pooledEdge, releaseWorldPool } from "./world-pool.ts";
import { refreshFixture } from "./fixtures.ts";

test("a pooled application resets storage, owns fresh transport state, and reconnects after release", async () => {
  const first = await pooledEdge();
  const { user } = await first.edge.application.concepts.Authenticating.register({
    username: "pool-owner",
    password: "password123",
    email: "pool@example.test",
  });
  await first.edge.application.whenIdle();
  expect(await first.edge.application.concepts.Authenticating._getUsers({})).toEqual([
    { user, username: "pool-owner", email: "pool@example.test" },
  ]);
  // Refreshing fixture caches uses a real admission refusal, without accepting a flow.
  expect(await first.edge.application.invoker.invoke("/auth/login", {})).toMatchObject({
    ok: false,
    error: { kind: "framework", code: "INVALID_INPUT" },
  });
  await refreshFixture(first.edge.application);
  await releaseWorldPool();
  await releaseWorldPool();
  const second = await pooledEdge("https://pool.example.test");
  expect(second.edge.application).toBe(first.edge.application);
  expect(second.edge.gateway).not.toBe(first.edge.gateway);
  expect(await second.edge.application.concepts.Authenticating._getUsers({})).toEqual([]);
  const registered = await second.edge.application.concepts.Authenticating.register({
    username: "pool-owner",
    password: "password123",
    email: "pool@example.test",
  });
  expect(registered.user).not.toBe(user);
});

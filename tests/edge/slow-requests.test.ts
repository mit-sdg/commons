import { afterAll, afterEach, expect, test, vi } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { slowRequestObserver } from "../../src/assembly/slow-requests.ts";

afterAll(stopTestDb);
afterEach(() => vi.restoreAllMocks());

const settled = (durationMs: number, route = "/live/p/wall-signed") =>
  ({
    type: "invocation-settled",
    at: Date.now(),
    route,
    correlationId: "corr-1",
    result: "success",
    durationMs,
  }) as const;

test("a request held past the threshold prints one line with route, duration, and correlation id", () => {
  const lines: string[] = [];
  const observe = slowRequestObserver((line) => lines.push(line));
  observe(settled(2_345.6));
  expect(lines).toEqual([
    "commons: slow request /live/p/wall-signed took 2346 ms (success, correlation corr-1)",
  ]);
});

test("a request that settled in time prints nothing, as does any other event", () => {
  const lines: string[] = [];
  const observe = slowRequestObserver((line) => lines.push(line));
  observe(settled(1_999));
  observe(settled(2_000));
  observe({ type: "drain-state", at: Date.now(), state: "idle" });
  expect(lines).toEqual([]);
});

test("a timed-out request is reported with the gateway's code", () => {
  const lines: string[] = [];
  const observe = slowRequestObserver((line) => lines.push(line));
  observe({
    ...settled(30_000, "/live/walls/read"),
    result: "framework-error",
    frameworkCode: "TIMED_OUT",
  });
  expect(lines).toEqual([
    "commons: slow request /live/walls/read took 30000 ms (TIMED_OUT, correlation corr-1)",
  ]);
});

test("the edge reports a slow request and stays quiet about a fast one", async () => {
  const instances = mongoImplementations(await testDb());
  const edge = createEdge(instances, "https://commons.test");
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  const lookup = instances.Authenticating._getByUsername.bind(instances.Authenticating);
  const held = vi
    .spyOn(instances.Authenticating, "_getByUsername")
    .mockImplementation(async (input) => {
      await new Promise((wake) => setTimeout(wake, 2_100));
      return lookup(input);
    });
  const login = (username: string) =>
    edge.fetch(
      new Request("https://commons.test/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: "password123" }),
      }),
    );
  expect((await login("nobody")).status).toBe(401);
  const slow = warned.mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith("commons: slow request"));
  expect(slow).toHaveLength(1);
  expect(slow[0]).toMatch(
    /^commons: slow request \/auth\/login took 2\d{3} ms \(domain-error, correlation [0-9a-f-]{36}\)$/,
  );
  held.mockRestore();
  warned.mockClear();
  expect((await login("nobody-else")).status).toBe(401);
  expect(
    warned.mock.calls.map((call) => String(call[0])).filter((line) => line.startsWith("commons:")),
  ).toEqual([]);
}, 20_000);

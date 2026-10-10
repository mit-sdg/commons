import { MongoClient } from "mongodb";
import { afterAll, beforeAll, expect, test, vi } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDbUri } from "../../src/concepts/testing.ts";
import { slowRequestLog, type SlowRequestLog } from "../../src/assembly/slow-requests.ts";
import { configuredSlowRequestMs } from "../../src/deployment.ts";

const databaseName = `slow-requests-${crypto.randomUUID()}`;
let client: MongoClient;
let currentLog: SlowRequestLog | undefined;

beforeAll(async () => {
  client = new MongoClient(await testDbUri(), { monitorCommands: true });
  client.on("commandStarted", () => currentLog?.countCommand());
  await client.connect();
});

afterAll(async () => {
  await client.db(databaseName).dropDatabase();
  await client.close();
});

/** An edge whose requests are timed by a log at `thresholdMs`, printing into `lines`. */
function edgeLoggingAt(thresholdMs: number | undefined) {
  const lines: string[] = [];
  currentLog =
    thresholdMs === undefined ? undefined : slowRequestLog(thresholdMs, (line) => lines.push(line));
  const instances = mongoImplementations(client.db(databaseName));
  const edge = createEdge(instances, "https://commons.test", undefined, currentLog);
  const login = (query = "") =>
    edge.fetch(
      new Request(`https://commons.test/api/auth/login${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "nobody", password: "password123" }),
      }),
    );
  const holdLookups = (ms: number) => {
    const lookup = instances.Authenticating._getByUsername.bind(instances.Authenticating);
    vi.spyOn(instances.Authenticating, "_getByUsername").mockImplementation(async (input) => {
      await new Promise((wake) => setTimeout(wake, ms));
      return lookup(input);
    });
  };
  return { edge, lines, login, holdLookups };
}

test("a request over the threshold logs one line with its logical path, time, and MongoDB commands", async () => {
  const { lines, login, holdLookups } = edgeLoggingAt(200);
  holdLookups(250);
  expect((await login("?session=query-secret&user=maya")).status).toBe(401);
  expect(lines).toHaveLength(1);
  const [, ms, commands] =
    /^commons: slow request \/auth\/login took (\d+) ms and (\d+) MongoDB commands\.$/.exec(
      lines[0],
    ) ?? [];
  expect(Number(ms)).toBeGreaterThanOrEqual(200);
  expect(Number(commands)).toBeGreaterThan(0);
  expect(lines[0]).not.toMatch(/\?|query-secret|maya|nobody/);
});

test("a request under the threshold logs nothing", async () => {
  const { lines, login } = edgeLoggingAt(10_000);
  expect((await login()).status).toBe(401);
  expect(lines).toEqual([]);
});

test("a path outside the served routes is logged without its text", async () => {
  const { edge, lines } = edgeLoggingAt(0);
  await edge.fetch(
    new Request("https://commons.test/api/reset/tok-123?code=9", { method: "POST" }),
  );
  await edge.fetch(new Request("https://commons.test/health/live"));
  expect(lines.map((line) => line.replace(/ took .*/, ""))).toEqual([
    "commons: slow request (unserved)",
    "commons: slow request /health/live",
  ]);
});

test("with logging off, a slow request logs nothing", async () => {
  expect(configuredSlowRequestMs({ SLOW_REQUEST_MS: "off" })).toBeUndefined();
  expect(configuredSlowRequestMs({ SLOW_REQUEST_MS: "0" })).toBeUndefined();
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  const logged = vi.spyOn(console, "log").mockImplementation(() => {});
  const { login, holdLookups } = edgeLoggingAt(undefined);
  holdLookups(250);
  expect((await login()).status).toBe(401);
  const printed = [...warned.mock.calls, ...logged.mock.calls].map((call) => String(call[0]));
  expect(printed.filter((line) => line.includes("slow request"))).toEqual([]);
});

test("SLOW_REQUEST_MS defaults to one second and refuses anything but whole milliseconds or off", () => {
  expect(configuredSlowRequestMs({})).toBe(1_000);
  expect(configuredSlowRequestMs({ SLOW_REQUEST_MS: "" })).toBe(1_000);
  expect(configuredSlowRequestMs({ SLOW_REQUEST_MS: " 250 " })).toBe(250);
  expect(configuredSlowRequestMs({ SLOW_REQUEST_MS: "OFF" })).toBeUndefined();
  for (const value of ["-1", "1.5", "1e3", "fast", "on"]) {
    expect(() => configuredSlowRequestMs({ SLOW_REQUEST_MS: value })).toThrow(
      `commons: SLOW_REQUEST_MS must be a whole number of milliseconds, 0, or off; received "${value}"`,
    );
  }
});

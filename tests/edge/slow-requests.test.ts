import { EventEmitter } from "node:events";
import { MongoClient } from "mongodb";
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDbUri } from "../../src/concepts/testing.ts";
import { slowRequestLog } from "../../src/assembly/slow-requests.ts";
import { configuredSlowRequestMs } from "../../src/deployment.ts";

const databaseName = `slow-requests-${crypto.randomUUID()}`;
let client: MongoClient;
const observed: MongoClient[] = [];

beforeAll(async () => {
  client = new MongoClient(await testDbUri());
  await client.connect();
});

afterEach(async () => {
  for (const each of observed.splice(0)) await each.close();
});

afterAll(async () => {
  await client.db(databaseName).dropDatabase();
  await client.close();
});

/** A client of its own, followed by `log`, that the test closes afterwards. */
async function observedClient(
  log: ReturnType<typeof slowRequestLog>,
  options: { maxPoolSize?: number } = {},
) {
  const own = new MongoClient(await testDbUri(), { ...options, monitorCommands: true });
  observed.push(own);
  log.observe(own);
  await own.connect();
  return own;
}

/** An edge whose requests are timed by a log at `thresholdMs`, printing into `lines`. */
async function edgeLoggingAt(thresholdMs: number | undefined) {
  const lines: string[] = [];
  const log =
    thresholdMs === undefined ? undefined : slowRequestLog(thresholdMs, (line) => lines.push(line));
  const database = (log === undefined ? client : await observedClient(log)).db(databaseName);
  const instances = mongoImplementations(database);
  const edge = createEdge(instances, "https://commons.test", undefined, log);
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

const sleep = (ms: number) => new Promise((wake) => setTimeout(wake, ms));
const withoutTime = (line: string) => line.replace(/ took \d+ ms/, "");

test("a request over the threshold logs one line with its logical path, time, and MongoDB commands", async () => {
  const { lines, login, holdLookups } = await edgeLoggingAt(200);
  holdLookups(250);
  expect((await login("?session=query-secret&user=maya")).status).toBe(401);
  expect(lines).toHaveLength(1);
  const [, ms, commands, waited] =
    /^commons: slow request \/auth\/login took (\d+) ms and (\d+) MongoDB commands, (\d+) ms of it waiting for a connection\.$/.exec(
      lines[0],
    ) ?? [];
  expect(Number(ms)).toBeGreaterThanOrEqual(200);
  expect(Number(commands)).toBeGreaterThan(0);
  expect(Number(waited)).toBeLessThanOrEqual(Number(ms));
  expect(lines[0]).not.toMatch(/\?|query-secret|maya|nobody/);
});

test("a request under the threshold logs nothing", async () => {
  const { lines, login } = await edgeLoggingAt(10_000);
  expect((await login()).status).toBe(401);
  expect(lines).toEqual([]);
});

test("a path outside the served routes is logged without its text", async () => {
  const { edge, lines } = await edgeLoggingAt(0);
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
  const { login, holdLookups } = await edgeLoggingAt(undefined);
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

test("a connection wait counts once, against the request whose command ran on the connection", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const driver = new EventEmitter();
  log.observe(driver as unknown as MongoClient);
  const checkedOut = (connectionId: number, durationMS: number) =>
    driver.emit("connectionCheckedOut", { address: "db:27017", connectionId, durationMS });
  const commandStarted = (connectionId: number) =>
    driver.emit("commandStarted", { address: "10.0.0.1:27017", connectionId });
  const checkOutFailed = (reason: string, durationMS: number) =>
    driver.emit("connectionCheckOutFailed", { address: "db:27017", reason, durationMS });

  let release = () => {};
  const released = new Promise<void>((wake) => (release = wake));
  await Promise.all([
    log.measure("/waiting", async () => {
      await released;
      commandStarted(1);
      commandStarted(2);
      return new Response();
    }),
    // The driver emits a finished wait from the context of the request that
    // freed the connection, so the other request's waits are emitted here.
    log.measure("/freeing", async () => {
      await sleep(80);
      checkedOut(1, 60);
      checkedOut(2, 40);
      checkedOut(3, 0);
      commandStarted(3);
      release();
      return new Response();
    }),
    log.measure("/timing-out", async () => {
      await sleep(80);
      checkOutFailed("timeout", 30);
      checkOutFailed("poolClosed", 50);
      return new Response();
    }),
  ]);
  expect(lines.map(withoutTime).sort()).toEqual([
    "commons: slow request /freeing and 1 MongoDB commands, 0 ms of it waiting for a connection.",
    "commons: slow request /timing-out and 0 MongoDB commands, 30 ms of it waiting for a connection.",
    "commons: slow request /waiting and 2 MongoDB commands, 60 ms of it waiting for a connection.",
  ]);
});

test("with one pooled connection, a request's queued reads are its own wait, not the wait of the request holding the connection", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const pooled = await observedClient(log, { maxPoolSize: 1 });
  const documents = pooled.db(databaseName).collection("pool-waits");
  await documents.insertOne({ kind: "pool-wait" });

  const holding = log.measure("/holding", async () => {
    await documents.find({ $where: "sleep(300) || true" }).toArray();
    return new Response();
  });
  await new Promise((wake) => pooled.once("commandStarted", wake));
  const queued = log.measure("/queued", async () => {
    await Promise.all([1, 2, 3, 4].map(() => documents.findOne({ kind: "pool-wait" })));
    return new Response();
  });
  await Promise.all([holding, queued]);

  const parsed = new Map(
    lines.map((line) => {
      const [, path, ms, commands, waited] =
        /^commons: slow request (\S+) took (\d+) ms and (\d+) MongoDB commands, (\d+) ms of it waiting for a connection\.$/.exec(
          line,
        ) ?? [];
      return [path, { ms: Number(ms), commands: Number(commands), waited: Number(waited) }];
    }),
  );
  const holder = parsed.get("/holding");
  const waiter = parsed.get("/queued");
  expect(holder?.commands).toBe(1);
  expect(holder?.waited).toBeLessThan(50);
  expect(waiter?.commands).toBe(4);
  expect(waiter?.waited).toBeGreaterThanOrEqual(200);
  expect(waiter?.waited).toBeLessThanOrEqual(waiter?.ms ?? 0);
});

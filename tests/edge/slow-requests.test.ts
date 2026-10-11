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
  options: { maxPoolSize?: number; monitorCommands?: boolean } = {},
) {
  const own = new MongoClient(await testDbUri(), options);
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

test("SLOW_REQUEST_MS defaults to one second, and anything but whole milliseconds turns the log off with one warning", () => {
  const warnings: string[] = [];
  const configured = (value: string | undefined) =>
    configuredSlowRequestMs({ SLOW_REQUEST_MS: value }, (line) => warnings.push(line));
  expect(configured(undefined)).toBe(1_000);
  expect(configured("")).toBe(1_000);
  expect(configured(" 250 ")).toBe(250);
  expect(configured("OFF")).toBeUndefined();
  expect(configured("0")).toBeUndefined();
  expect(warnings).toEqual([]);
  for (const value of ["-1", "1.5", "1e3", "fast", "on"]) {
    expect(configured(value)).toBeUndefined();
  }
  expect(warnings).toEqual(
    ["-1", "1.5", "1e3", "fast", "on"].map(
      (value) =>
        `commons: SLOW_REQUEST_MS "${value}" is not a number of milliseconds; slow requests are not logged.`,
    ),
  );
});

/** Reads the figures from each logged line, by path. */
function figures(lines: readonly string[]) {
  return new Map(
    lines.map((line) => {
      const [, path, ms, commands, waited] =
        /^commons: slow request (\S+) took (\d+) ms and (\d+) MongoDB commands, (\d+) ms of it waiting for a connection\.$/.exec(
          line,
        ) ?? [];
      return [path, { ms: Number(ms), commands: Number(commands), waited: Number(waited) }];
    }),
  );
}

test("a connection wait counts once, against the request whose checkout it ends, in whatever order waits end", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const driver = new EventEmitter();
  log.observe(driver as unknown as MongoClient);
  const address = "db:27017";
  // Like the driver: a checkout is stamped with the whole millisecond it
  // started, and its end reports the whole milliseconds since then.
  const checkOutStarted = () => {
    driver.emit("connectionCheckOutStarted", { address });
    return Math.floor(performance.now());
  };
  const since = (started: number) => Math.floor(performance.now()) - started;
  const checkedOut = (started: number) =>
    driver.emit("connectionCheckedOut", { address, connectionId: 1, durationMS: since(started) });
  const checkOutFailed = (started: number, reason: string) =>
    driver.emit("connectionCheckOutFailed", { address, reason, durationMS: since(started) });

  let release = () => {};
  const released = new Promise<void>((wake) => (release = wake));
  const checkouts: number[] = [];
  await Promise.all([
    log.measure("/early", async () => {
      checkouts[0] = checkOutStarted();
      await released;
      return new Response();
    }),
    log.measure("/late", async () => {
      await sleep(40);
      checkouts[1] = checkOutStarted();
      await released;
      return new Response();
    }),
    log.measure("/timing-out", async () => {
      const started = checkOutStarted();
      await sleep(50);
      checkOutFailed(started, "timeout");
      await released;
      return new Response();
    }),
    // The driver ends waits from the context of whatever freed or opened a
    // connection, and a connection opened for the earlier checkout can arrive
    // after a later checkout was served.
    log.measure("/freeing", async () => {
      await sleep(100);
      checkOutFailed(checkouts[1], "connectionError");
      checkedOut(checkouts[0]);
      checkedOut(checkOutStarted());
      release();
      return new Response();
    }),
  ]);
  const by = figures(lines);
  const early = by.get("/early");
  const late = by.get("/late");
  const timingOut = by.get("/timing-out");
  const freeing = by.get("/freeing");
  expect([early, late, timingOut, freeing].map((request) => request?.commands)).toEqual([
    1, 1, 1, 1,
  ]);
  expect(early?.waited).toBeGreaterThanOrEqual(90);
  expect(late?.waited).toBeGreaterThanOrEqual(40);
  expect(late?.waited).toBeLessThanOrEqual((early?.waited ?? 0) - 30);
  expect(timingOut?.waited).toBeGreaterThanOrEqual(45);
  expect(timingOut?.waited).toBeLessThanOrEqual(timingOut?.ms ?? 0);
  expect(freeing?.waited).toBeLessThanOrEqual(2);
});

test("overlapping waits count once", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const driver = new EventEmitter();
  log.observe(driver as unknown as MongoClient);
  const address = "db:27017";
  await log.measure("/overlapping", async () => {
    const started = Math.floor(performance.now());
    for (let checkout = 0; checkout < 3; checkout += 1) {
      driver.emit("connectionCheckOutStarted", { address });
    }
    await sleep(60);
    for (let checkout = 0; checkout < 3; checkout += 1) {
      const durationMS = Math.floor(performance.now()) - started;
      driver.emit("connectionCheckedOut", { address, connectionId: checkout, durationMS });
    }
    return new Response();
  });
  const overlapping = figures(lines).get("/overlapping");
  expect(overlapping?.commands).toBe(3);
  expect(overlapping?.waited).toBeGreaterThanOrEqual(55);
  expect(overlapping?.waited).toBeLessThanOrEqual(overlapping?.ms ?? 0);
});

test("with one pooled connection, a request's queued reads are its own wait, not the wait of the request holding the connection", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const pooled = await observedClient(log, { maxPoolSize: 1 });
  const documents = pooled.db(databaseName).collection("pool-waits");
  await documents.insertOne({ kind: "pool-wait" });

  const held = new Promise((wake) => pooled.once("connectionCheckedOut", wake));
  const holding = log.measure("/holding", async () => {
    await documents.find({ $where: "sleep(300) || true" }).toArray();
    return new Response();
  });
  await held;
  const queued = log.measure("/queued", async () => {
    await Promise.all([1, 2, 3, 4].map(() => documents.findOne({ kind: "pool-wait" })));
    return new Response();
  });
  await Promise.all([holding, queued]);

  const by = figures(lines);
  const holder = by.get("/holding");
  const waiter = by.get("/queued");
  expect(holder?.commands).toBe(1);
  expect(holder?.waited).toBeLessThan(50);
  expect(waiter?.commands).toBe(4);
  expect(waiter?.waited).toBeGreaterThanOrEqual(200);
  expect(waiter?.waited).toBeLessThanOrEqual(waiter?.ms ?? 0);
});

test("the commands counted from checkouts match the commands the driver sends", async () => {
  const lines: string[] = [];
  const log = slowRequestLog(0, (line) => lines.push(line));
  const monitored = await observedClient(log, { monitorCommands: true });
  let sent = 0;
  monitored.on("commandStarted", () => (sent += 1));
  const documents = monitored.db(databaseName).collection("counted");
  const login = createEdge(
    mongoImplementations(monitored.db(databaseName)),
    "https://commons.test",
    undefined,
    log,
  ).fetch(
    new Request("https://commons.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "nobody", password: "password123" }),
    }),
  );
  expect((await login).status).toBe(401);
  await log.measure("/mixed", async () => {
    await documents.createIndex({ thread: 1 });
    await documents.insertMany(
      Array.from({ length: 7 }, (_, index) => ({ thread: index % 2, index })),
    );
    await documents.find({}).batchSize(2).toArray();
    const cursor = documents.find({}).batchSize(2);
    await cursor.next();
    await cursor.close();
    await documents.findOne({ index: 3 });
    await documents.findOneAndUpdate({ index: 3 }, { $set: { seen: true } });
    await documents.updateOne({ index: 4 }, { $set: { seen: true } });
    await documents.countDocuments({ thread: 1 });
    await documents.distinct("thread");
    await documents.aggregate([{ $group: { _id: "$thread", count: { $sum: 1 } } }]).toArray();
    await documents.bulkWrite([
      { updateOne: { filter: { index: 5 }, update: { $set: { seen: true } } } },
      { deleteOne: { filter: { index: 6 } } },
    ]);
    await documents.deleteMany({ seen: true });
    return new Response();
  });
  const counted = [...figures(lines).values()].reduce(
    (total, request) => total + request.commands,
    0,
  );
  expect(counted).toBe(sent);
  expect(figures(lines).get("/mixed")?.commands).toBeGreaterThan(14);
});

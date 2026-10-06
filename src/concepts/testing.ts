import { type Db, MongoClient } from "mongodb";

export async function caughtError(fn: () => unknown): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected an error");
}

let shared: Promise<MongoClient> | undefined;
// Isolation may reload this module, and thread workers share a process id.
const namespace = `${process.pid}-${crypto.randomUUID()}`;
let databases = 0;
const owned: Db[] = [];

async function boot() {
  const client = new MongoClient(await testDbUri());
  await client.connect();
  return client;
}

export async function testDb(): Promise<Db> {
  shared ??= boot();
  const client = await shared;
  databases += 1;
  const db = client.db(`test-${namespace}-${databases}`);
  owned.push(db);
  return db;
}

/** The run's server address, for a test that needs a client of its own. */
export async function testDbUri(): Promise<string> {
  const uri = process.env.COMMONS_TEST_MONGO_URI;
  if (uri === undefined) throw new Error("testDb requires the Vitest Mongo global setup");
  return uri;
}

/** Discard this file's databases and close its client; keep the run's server. */
export async function stopTestDb(): Promise<void> {
  if (shared === undefined) return;
  const client = await shared;
  shared = undefined;
  const discarded = owned.splice(0);
  try {
    for (const db of discarded) await db.dropDatabase();
  } finally {
    await client.close();
  }
}

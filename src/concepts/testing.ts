import { type Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";

export async function caughtError(fn: () => unknown): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected an error");
}

let shared: Promise<{ client: MongoClient; server: MongoMemoryServer }> | undefined;
let databases = 0;

async function boot() {
  const server = await MongoMemoryServer.create();
  const client = new MongoClient(server.getUri());
  await client.connect();
  return { client, server };
}

export async function testDb(): Promise<Db> {
  shared ??= boot();
  const { client } = await shared;
  databases += 1;
  return client.db(`test-${databases}`);
}

/** The shared server's address, for a test that needs a client of its own. */
export async function testDbUri(): Promise<string> {
  shared ??= boot();
  return (await shared).server.getUri();
}

/**
 * The server's own stop waits ten seconds on a graceful shutdown before it
 * kills mongod, longer than a hook may take under load. Its data is thrown
 * away, so a mongod still shutting down after a moment is killed at once.
 */
const GRACE_MS = 1_000;

export async function stopTestDb(): Promise<void> {
  if (shared === undefined) return;
  const { client, server } = await shared;
  shared = undefined;
  await client.close();
  const mongod = server.instanceInfo?.instance.mongodProcess;
  const kill = setTimeout(() => mongod?.kill("SIGKILL"), GRACE_MS);
  try {
    await server.stop();
  } finally {
    clearTimeout(kill);
  }
}

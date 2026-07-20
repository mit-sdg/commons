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

export async function stopTestDb(): Promise<void> {
  if (shared === undefined) return;
  const { client, server } = await shared;
  shared = undefined;
  await client.close();
  await server.stop();
}

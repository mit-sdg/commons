import { checkBatchedQuery } from "@mit-sdg/sync-engine/assembly";
import { type Db, MongoClient } from "mongodb";
import { isDeepStrictEqual } from "node:util";

export async function caughtError(fn: () => unknown): Promise<Error> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error) return error;
    throw error;
  }
  throw new Error("expected an error");
}

/**
 * Check a batched query's list form: the engine's law for it, and that each input
 * answers as the single form it replaced did, given here as `single`.
 */
export async function checkListForm<Input extends Record<string, unknown>>(
  concept: object,
  query: string,
  inputs: readonly Input[],
  single: (input: Input) => Promise<unknown>,
): Promise<void> {
  await checkBatchedQuery(concept, query, inputs);
  const list = (concept as Record<string, (inputs: readonly Input[]) => Promise<unknown[]>>)[query];
  const answers = await list!.call(concept, inputs);
  for (const [position, input] of inputs.entries()) {
    const expected = await single(input);
    if (!isDeepStrictEqual(answers[position], expected)) {
      throw new Error(
        `${query}(${JSON.stringify(input)}) answered ${JSON.stringify(answers[position])} ` +
          `in list form but ${JSON.stringify(expected)} in single form.`,
      );
    }
  }
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

import { assembleLive, assembleForum, assembleTasks } from "./domain-world.ts";
import { pooledLifecycle } from "./world-lifecycle.ts";
import { MongoClient } from "mongodb";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDbUri } from "../../src/concepts/testing.ts";
import { createEdgeForApplication } from "../../src/edge.ts";
import { clearFixtureDb, refreshFixture } from "./fixtures.ts";

type Domain = "commons" | "live" | "forum" | "tasks";
const worlds = new Map<Domain, { value: ReturnType<typeof build>; borrowed: boolean }>();
async function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("fixture pool did not settle before its cleanup deadline")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function resetWorld(value: Awaited<ReturnType<typeof build>>) {
  await value.app.whenIdle();
  await clearFixtureDb(value.db);
}

async function build(domain: Domain) {
  const client = new MongoClient(await testDbUri());
  try {
    await client.connect();
    const db = client.db(`fixture-pool-${domain}-${crypto.randomUUID()}`);
    const instances = mongoImplementations(db);
    const builders = {
      commons: assembleCommons,
      live: assembleLive,
      forum: assembleForum,
      tasks: assembleTasks,
    };
    const app = builders[domain](instances);
    return { client, db, instances, app };
  } catch (error) {
    await client.close();
    throw error;
  }
}

/** Exclusive ordinary world for one sequential test file; clocks/faults stay separate. */
async function borrow(domain: Domain = "commons") {
  pooledLifecycle.release = releaseWorldPool;
  let world = worlds.get(domain);
  if (world === undefined) {
    world = {
      value: build(domain).catch((error) => {
        worlds.delete(domain);
        throw error;
      }),
      borrowed: false,
    };
    worlds.set(domain, world);
  }
  const value = await world.value;
  world.borrowed = true;
  try {
    await value.client.connect();
    await bounded(resetWorld(value), 5_000);
    await refreshFixture(value.app);
    return value;
  } catch (error) {
    try {
      await bounded(value.client.close(), 2_000);
    } finally {
      world.borrowed = false;
      worlds.delete(domain);
    }
    throw error;
  }
}

export async function pooledEdge(origin?: string) {
  const value = await borrow();
  return { db: value.db, edge: createEdgeForApplication(value.app, value.instances, origin) };
}

/** Close sockets at every file boundary while retaining the compiled application. */
export async function releaseWorldPool() {
  const errors: unknown[] = [];
  for (const [domain, world] of worlds) {
    if (!world.borrowed) continue;
    const value = await world.value;
    try {
      await bounded(resetWorld(value), 5_000);
    } catch (error) {
      errors.push(error);
      worlds.delete(domain);
    } finally {
      try {
        await bounded(value.client.close(), 2_000);
      } catch (error) {
        errors.push(error);
      }
      world.borrowed = false;
    }
  }
  if (errors.length !== 0) throw new AggregateError(errors, "fixture pool cleanup failed");
}

export async function pooledApplication() {
  const { db, app, instances } = await borrow();
  return { db, app, instances };
}

export async function pooledLiveEdge(origin?: string) {
  const value = await borrow("live");
  return { db: value.db, edge: createEdgeForApplication(value.app, value.instances, origin) };
}

export async function pooledForumApplication() {
  const { db, app, instances } = await borrow("forum");
  return { db, app, instances };
}

export async function pooledTaskApplication() {
  const { db, app } = await borrow("tasks");
  return { db, app };
}

import type { Db, Document } from "mongodb";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { testDb } from "../../src/concepts/testing.ts";
import { createEdgeForApplication } from "../../src/edge.ts";

type Application = ReturnType<typeof assembleCommons>;
type Edge = ReturnType<typeof createEdgeForApplication>;
type World = {
  db: Db;
  edge: { application: Pick<Application, "whenIdle" | "invoker"> };
  resetEdge?: () => void;
};

export async function createCommonsApplication(clock?: () => Date) {
  const db = await testDb();
  const instances = mongoImplementations(db);
  return { db, instances, app: assembleCommons(instances, clock) };
}

/** Keep request closures' edge reference, but give it real, fresh HTTP state. */
export function refreshEdge(
  edge: Edge,
  instances: Parameters<typeof createEdgeForApplication>[1],
  origin?: string,
  clock?: () => Date,
) {
  Object.assign(edge, createEdgeForApplication(edge.application, instances, origin, clock));
}

export async function createCommonsFixture(origin?: string, clock?: () => Date) {
  const world = await createCommonsApplication(clock);
  const edge = createEdgeForApplication(world.app, world.instances, origin, clock);
  return { ...world, edge, resetEdge: () => refreshEdge(edge, world.instances, origin, clock) };
}

/** The real invoker clears query caches before refusing missing login inputs. */
export async function refreshFixture(app: Pick<Application, "invoker">) {
  const result = await app.invoker.invoke("/auth/login", {});
  if (result.ok || result.error.kind !== "framework" || result.error.code !== "INVALID_INPUT")
    throw new Error("fixture cache refresh requires the native /auth/login input refusal");
}

export async function clearFixtureDb(db: Db) {
  await Promise.all((await db.collections()).map((collection) => collection.deleteMany({})));
}

/** Per-file fixture: prepare once, then restore rows without dropping indexes. */
export function reusableFixture<Value extends World>(
  build: () => Promise<Value>,
  reset?: (value: Value) => void,
  seed = true,
) {
  let prepared: { value: Value; rows: { name: string; docs: Document[] }[] } | undefined;
  return async (): Promise<Value> => {
    if (prepared === undefined) {
      const value = await build();
      await value.edge.application.whenIdle();
      const rows = seed
        ? await Promise.all(
            (await value.db.collections()).map(async (collection) => ({
              name: collection.collectionName,
              docs: await collection.find({}).toArray(),
            })),
          )
        : [];
      prepared = { value, rows };
      return value;
    } else {
      await prepared.value.edge.application.whenIdle();
      await clearFixtureDb(prepared.value.db);
      await Promise.all(
        prepared.rows
          .filter(({ docs }) => docs.length)
          .map(({ name, docs }) => prepared!.value.db.collection(name).insertMany(docs)),
      );
    }
    reset?.(prepared.value);
    await refreshFixture(prepared.value.edge.application);
    prepared.value.resetEdge?.();
    return prepared.value;
  };
}

export function emptyFixture<Value extends World>(build: () => Promise<Value>) {
  return reusableFixture(build, undefined, false);
}

export function emptyApplication<Value extends { db: Db; app: Application }>(
  build: () => Promise<Value>,
) {
  const fixture = emptyFixture(async () => {
    const value = await build();
    return { ...value, edge: { application: value.app } };
  });
  return async (): Promise<Value["app"]> => (await fixture()).app;
}

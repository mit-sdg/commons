import { refreshFixtureEdge } from "./edge-fixture.ts";
import type { Db, Document } from "mongodb";

type FixtureApplication = {
  whenIdle(): Promise<void>;
  invoker: {
    invoke(
      path: string,
      input: Record<string, unknown>,
    ): Promise<{ ok: boolean; error?: { kind: string; code?: string } }>;
  };
};

/** Admission refreshes query caches before refusing this missing input. */
export async function refreshFixture(app: FixtureApplication) {
  const result = await app.invoker.invoke("/auth/login", {});
  if (result.ok || result.error?.kind !== "framework" || result.error.code !== "INVALID_INPUT") {
    throw new Error("fixture cache refresh requires the native /auth/login input refusal");
  }
}

/** Retain indexes while giving a reused application empty concept state. */
export async function clearFixtureDb(db: Db) {
  await Promise.all((await db.collections()).map((collection) => collection.deleteMany({})));
}

/** A fresh logical world on one real application, for non-trace scenarios. */
export function emptyFixture<
  Value extends {
    db: Db;
    edge: { application: FixtureApplication };
  },
>(build: () => Promise<Value>) {
  let value: Value | undefined;
  return async () => {
    if (value === undefined) value = await build();
    else {
      await value.edge.application.whenIdle();
      await clearFixtureDb(value.db);
      await refreshFixture(value.edge.application);
      refreshFixtureEdge(value.edge);
    }
    return value;
  };
}

export function emptyApplication<
  Value extends {
    db: Db;
    app: FixtureApplication;
  },
>(build: () => Promise<Value>) {
  let value: Value | undefined;
  return async (): Promise<Value["app"]> => {
    if (value === undefined) value = await build();
    else {
      await value.app.whenIdle();
      await clearFixtureDb(value.db);
      await refreshFixture(value.app);
    }
    return value.app;
  };
}

/**
 * Build an expensive world through real actions once, then restore its stored
 * state between scenarios. Callers reset any in-memory fault gates separately.
 * Trace/occurrence tests should continue to construct their own application.
 */
export function reusableFixture<
  Value extends {
    db: Db;
    edge: { application: FixtureApplication };
  },
>(build: () => Promise<Value>, reset?: (value: Value) => void) {
  let prepared: Promise<{ value: Value; rows: { name: string; docs: Document[] }[] }> | undefined;
  return async (): Promise<Value> => {
    if (prepared === undefined) {
      prepared = (async () => {
        const value = await build();
        await value.edge.application.whenIdle();
        const rows = await Promise.all(
          (await value.db.collections()).map(async (collection) => ({
            name: collection.collectionName,
            docs: await collection.find({}).toArray(),
          })),
        );
        await refreshFixture(value.edge.application);
        refreshFixtureEdge(value.edge);
        return { value, rows };
      })();
      return (await prepared).value;
    }
    const { value, rows } = await prepared;
    await value.edge.application.whenIdle();
    await clearFixtureDb(value.db);
    await Promise.all(
      rows
        .filter(({ docs }) => docs.length !== 0)
        .map(({ name, docs }) => value.db.collection(name).insertMany(docs)),
    );
    reset?.(value);
    await refreshFixture(value.edge.application);
    refreshFixtureEdge(value.edge);
    return value;
  };
}

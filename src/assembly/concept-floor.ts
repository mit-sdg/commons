import { conceptFloor } from "@mit-sdg/sync-engine/assembly";
import type { Db, MongoClient } from "mongodb";
import { applicationConceptSet, mongoImplementations } from "../concepts.ts";

export type CommonsConceptFloor = Omit<ReturnType<typeof conceptFloor>, "instances"> & {
  instances: ReturnType<typeof mongoImplementations>;
};

type MongoClientFactory = (url: string) => Promise<MongoClient>;

const INVALID_MONGODB_URL = "commons: MONGODB_URL is not a valid MongoDB connection URL.";
const MONGODB_CONNECTION_FAILED = "commons: could not connect to the configured MongoDB.";

const noDatabaseSelection = (url: string): boolean => {
  const scheme = url.indexOf("://");
  if (scheme === -1) return true;
  const path = url.indexOf("/", scheme + 3);
  if (path === -1) return true;
  const query = url.indexOf("?", path);
  const fragment = url.indexOf("#", path);
  const end = Math.min(...[query, fragment, url.length].filter((position) => position !== -1));
  return url.slice(path + 1, end) === "";
};

async function connectMongo(url: string): Promise<MongoClient> {
  const v8 = await import("node:v8");
  v8.startupSnapshot.isBuildingSnapshot = () => false;
  const { MongoClient } = await import("mongodb");
  let client: MongoClient;
  try {
    client = new MongoClient(url, {
      connectTimeoutMS: 5_000,
      serverSelectionTimeoutMS: 5_000,
    });
  } catch {
    throw new Error(INVALID_MONGODB_URL);
  }
  try {
    await client.connect();
    return client;
  } catch {
    await client.close().catch(() => undefined);
    throw new Error(MONGODB_CONNECTION_FAILED);
  }
}

export async function constructConceptFloor(
  mongodbUrl?: string,
  createClient: MongoClientFactory = connectMongo,
): Promise<CommonsConceptFloor> {
  if (mongodbUrl === undefined) {
    throw new Error("commons: MONGODB_URL is required.");
  }
  if (!/^mongodb(?:\+srv)?:\/\//.test(mongodbUrl)) {
    throw new Error(INVALID_MONGODB_URL);
  }
  if (noDatabaseSelection(mongodbUrl)) {
    throw new Error("commons: MONGODB_URL must select a database in its path.");
  }

  let client: MongoClient;
  try {
    client = await createClient(mongodbUrl);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === INVALID_MONGODB_URL || error.message === MONGODB_CONNECTION_FAILED)
    ) {
      throw error;
    }
    throw new Error(MONGODB_CONNECTION_FAILED);
  }

  let database: Db;
  try {
    database = client.db();
  } catch {
    await client.close().catch(() => undefined);
    throw new Error(INVALID_MONGODB_URL);
  }

  let instances: ReturnType<typeof mongoImplementations>;
  try {
    instances = mongoImplementations(database);
  } catch {
    await client.close().catch(() => undefined);
    throw new Error("commons: could not prepare Commons to use the configured MongoDB.");
  }

  let closed = false;
  // beta.10's public generic constraint is wider than a set with required floors;
  // retain the concrete instance type while calling the documented concept-set API.
  return conceptFloor(applicationConceptSet as unknown as Parameters<typeof conceptFloor>[0], {
    name: "mongo",
    instances,
    resources: [`MongoDB database ${database.databaseName}`],
    async close() {
      if (closed) return;
      closed = true;
      await client.close();
    },
  }) as CommonsConceptFloor;
}

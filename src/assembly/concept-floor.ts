import { conceptFloor, type ConceptFloor } from "@mit-sdg/sync-engine/assembly";
import type { Db, MongoClient } from "mongodb";
import { learningConcepts, vocabulary } from "../concepts/index.ts";

export type CommonsConceptFloor = ConceptFloor<typeof vocabulary>;

type MongoClientFactory = (url: string) => Promise<MongoClient>;

const INVALID_MONGODB_URL = "commons: MONGODB_URL is not a valid MongoDB connection URL.";
const MONGODB_CONNECTION_FAILED = "commons: could not connect to the configured MongoDB.";

export function memoryImplementations() {
  return learningConcepts.implementations();
}

export function mongoImplementations(database: Db) {
  return learningConcepts.implementations("mongo", { database });
}

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
    return conceptFloor(vocabulary, {
      name: "memory",
      instances: memoryImplementations(),
      resources: [],
      async close() {},
    });
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
  return conceptFloor(vocabulary, {
    name: "mongo",
    instances,
    resources: [`MongoDB database ${database.databaseName}`],
    async close() {
      if (closed) return;
      closed = true;
      await client.close();
    },
  });
}

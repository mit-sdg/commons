import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { testMongoServer } from "./mongo-server.ts";

/** One disposable service per run; every testDb call selects a fresh database. */
export default async function setup() {
  const mongo = await testMongoServer();
  const previous = process.env.COMMONS_TEST_MONGO_URI;
  const previousProjections = process.env.COMMONS_TEST_PROJECTIONS;
  const projections = mkdtempSync(join(tmpdir(), "commons-test-projections-"));
  process.env.COMMONS_TEST_PROJECTIONS = projections;
  process.env.COMMONS_TEST_MONGO_URI = mongo.server.getUri();
  return async () => {
    if (previous === undefined) delete process.env.COMMONS_TEST_MONGO_URI;
    else process.env.COMMONS_TEST_MONGO_URI = previous;
    if (previousProjections === undefined) delete process.env.COMMONS_TEST_PROJECTIONS;
    else process.env.COMMONS_TEST_PROJECTIONS = previousProjections;
    try {
      await mongo.stop();
    } finally {
      rmSync(projections, { recursive: true, force: true });
    }
  };
}

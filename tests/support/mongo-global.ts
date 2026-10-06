import { testMongoServer } from "./mongo-server.ts";

/** One disposable service per run; every testDb call selects a fresh database. */
export default async function setup() {
  const mongo = await testMongoServer();
  const previous = process.env.COMMONS_TEST_MONGO_URI;
  process.env.COMMONS_TEST_MONGO_URI = mongo.server.getUri();
  return async () => {
    if (previous === undefined) delete process.env.COMMONS_TEST_MONGO_URI;
    else process.env.COMMONS_TEST_MONGO_URI = previous;
    await mongo.stop();
  };
}

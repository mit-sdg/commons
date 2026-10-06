import { afterAll, expect, test } from "vite-plus/test";
import { inspectAssembly } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { occurrences } from "./occurrences.ts";

afterAll(stopTestDb);

test("the lightweight journal agrees with native redacted occurrence inspection", async () => {
  const app = assembleCommons(mongoImplementations(await testDb()));
  await app.concepts.Authenticating.register({
    username: "journal-owner",
    password: "private-password",
    email: "journal@example.test",
  });
  await app.whenIdle();
  expect(occurrences(app)).toEqual(inspectAssembly(app).occurrences);
  expect(JSON.stringify(occurrences(app))).not.toContain("private-password");
});

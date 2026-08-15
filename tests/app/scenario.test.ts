import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { runScenario } from "../../src/scenario.ts";

describe("the Commons scenario", () => {
  test("crosses registration, authentication, writing, and reading through the generated client", async () => {
    await expect(runScenario(mongoImplementations(await testDb()))).resolves.toEqual({
      registered: true,
      threadCreated: true,
      conversations: 1,
      firstPost: "What should a course make possible?",
    });
  });
});

afterAll(stopTestDb);

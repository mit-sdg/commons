import { describe, expect, test } from "vite-plus/test";
import { runScenario } from "../../src/scenario.ts";

describe("the Commons scenario", () => {
  test("crosses registration, authentication, writing, and reading through the generated client", async () => {
    await expect(runScenario()).resolves.toEqual({
      registered: true,
      threadCreated: true,
      conversations: 1,
      firstPost: "What should a course make possible?",
    });
  });
});

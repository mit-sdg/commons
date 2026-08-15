import { afterAll, describe, expect, test } from "vite-plus/test";
import { mongoImplementations } from "../../src/concepts.ts";
import { stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { commonsHttpPolicy } from "../../src/assembly/http-policy.ts";

describe("Commons deployment policy", () => {
  test("names implementations and owns the HTTP session-cookie binding", async () => {
    const implementations = mongoImplementations(await testDb());
    const policy = commonsHttpPolicy("http://127.0.0.1:3000");
    const session = policy.cookies?.session;

    expect(implementations.Sessioning.constructor.name).toBe("MongoSessioningConcept");
    expect(policy.basePath).toBe("/api");
    expect(session?.input).toBe("session");
    expect(session?.issue).toEqual([
      { path: "/auth/login", value: "session", expires: "expiresAt" },
    ]);
    expect(session?.clear).toEqual(["/auth/logout", "/auth/changePassword"]);
  });
});

afterAll(stopTestDb);

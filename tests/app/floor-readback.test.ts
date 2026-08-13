import { describe, expect, test } from "vite-plus/test";
import { memoryImplementations } from "../../src/assembly/concept-floor.ts";
import { commonsHttpPolicy } from "../../src/assembly/http-policy.ts";

describe("Commons deployment policy", () => {
  test("names implementations and owns the HTTP session-cookie binding", () => {
    const implementations = memoryImplementations();
    const policy = commonsHttpPolicy("http://127.0.0.1:3000");
    const session = policy.cookies?.session;

    expect(implementations.Sessioning.constructor.name).toBe("SessioningConcept");
    expect(policy.basePath).toBe("/api");
    expect(session?.input).toBe("session");
    expect(session?.issue).toEqual([
      { path: "/auth/login", value: "session", expires: "expiresAt" },
    ]);
    expect(session?.clear).toEqual(["/auth/logout", "/auth/changePassword"]);
  });
});

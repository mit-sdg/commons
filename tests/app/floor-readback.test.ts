import { describe, expect, test } from "vite-plus/test";
import { floorReadBack } from "@mit-sdg/sync-engine/tooling";
import { assembleCommons } from "../../src/assembly/application.ts";
import { memoryImplementations } from "../../src/assembly/concept-floor.ts";
import { commonsHttpFloor } from "../../src/assembly/http-floor.ts";

describe("Commons floor read-back", () => {
  test("names implementations, resources, and the HTTP credential binding", () => {
    const application = assembleCommons();
    const readBack = floorReadBack({
      application,
      conceptFloor: {
        name: "memory",
        instances: memoryImplementations(),
        resources: [],
      },
      httpFloor: commonsHttpFloor("http://127.0.0.1:3000"),
    });

    expect(readBack).toContain('Concept floor "memory".');
    expect(readBack).toContain("Sessioning: SessioningConcept");
    expect(readBack).toContain("Resources: none.");
    expect(readBack).toContain('Credential "session" binds cookie-only input "session"');
    expect(readBack).toContain("/auth/login");
    expect(readBack).toContain("/auth/logout, /auth/changePassword");
  });
});

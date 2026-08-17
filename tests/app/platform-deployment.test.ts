import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vite-plus/test";
import { platformProcessEnvironments } from "../../scripts/start-platform.ts";

const root = join(import.meta.dirname, "../..");
const platformContract = `version: 1
runtime: bun
packages:
  - .
  - frontend
scripts:
  build: build
  start: platform:start
port: 3000
health:
  path: /health
`;

describe("the managed-platform deployment", () => {
  test("declares only the strict Bun recipe contract", () => {
    expect(readFileSync(join(root, "platform.yaml"), "utf8")).toBe(platformContract);

    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.scripts.build).toBe(
      "bun run --cwd frontend build && bun scripts/prepare-platform.ts",
    );
    expect(manifest.scripts["platform:start"]).toBe("bun scripts/start-platform.ts");
    expect(existsSync(join(root, "Dockerfile.platform"))).toBe(false);
  });

  test("binds the frontend to PORT and keeps the backend on loopback", () => {
    const environments = platformProcessEnvironments({
      PORT: "3210",
      COMMONS_FRONTEND_PORT: "9999",
      COMMONS_BACKEND_PORT: "4321",
      MONGODB_URI: "mongodb://example.invalid/commons",
    });

    expect(environments.frontend.PORT).toBe("3210");
    expect(environments.frontend.HOSTNAME).toBe("0.0.0.0");
    expect(environments.frontend.BACKEND_ORIGIN).toBe("http://127.0.0.1:4321");
    expect(environments.backend.PORT).toBe("4321");
    expect(environments.backend.HOST).toBe("127.0.0.1");
    expect(environments.backend.MONGODB_URI).toBe("mongodb://example.invalid/commons");
  });

  test("uses the declared and internal ports by default", () => {
    const environments = platformProcessEnvironments({});

    expect(environments.frontend.PORT).toBe("3000");
    expect(environments.backend.PORT).toBe("4000");
    expect(environments.frontend.NEXT_TELEMETRY_DISABLED).toBe("1");
  });
});

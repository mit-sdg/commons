import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { backendReadinessResponse } from "../../frontend/src/lib/health.ts";
import { platformProcessEnvironments } from "../../scripts/start-platform.ts";
import { validateDeploymentConfiguration } from "../../src/deployment.ts";

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
      "BACKEND_ORIGIN=http://127.0.0.1:4000 bun run --cwd frontend build && bun scripts/prepare-platform.ts",
    );
    expect(manifest.scripts["platform:start"]).toBe("bun scripts/start-platform.ts");
    expect(existsSync(join(root, "Dockerfile.platform"))).toBe(false);
    expect(existsSync(join(root, "Dockerfile.backend"))).toBe(true);
    expect(existsSync(join(root, "Dockerfile.frontend"))).toBe(true);
  });

  test("binds the frontend to PORT and pins the backend to loopback port 4000", async () => {
    const environments = platformProcessEnvironments({
      PORT: "3210",
      COMMONS_FRONTEND_PORT: "9999",
      COMMONS_BACKEND_PORT: "4321",
      MONGODB_URI: "mongodb://example.invalid/commons",
    });

    expect(environments.frontend.PORT).toBe("3210");
    expect(environments.frontend.HOSTNAME).toBe("0.0.0.0");
    expect(environments.frontend.BACKEND_ORIGIN).toBe("http://127.0.0.1:4000");
    expect(environments.backend.PORT).toBe("4000");
    expect(environments.backend.HOST).toBe("127.0.0.1");
    expect(environments.backend.MONGODB_URI).toBe("mongodb://example.invalid/commons");

    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const buildOrigin = manifest.scripts.build.match(/^BACKEND_ORIGIN=([^ ]+)/)?.[1];
    expect(buildOrigin).toBe(environments.frontend.BACKEND_ORIGIN);

    const nextConfig = readFileSync(join(root, "frontend/next.config.ts"), "utf8");
    const configuredOrigin = nextConfig.match(
      /BACKEND_ORIGIN = process\.env\.BACKEND_ORIGIN \?\? "([^"]+)"/,
    )?.[1];
    expect(nextConfig).toContain("destination: `${BACKEND_ORIGIN}/api/:path*`");

    const fetchBackend = vi.fn(
      async (_input: URL, _init: RequestInit) => new Response(null, { status: 200 }),
    );
    await backendReadinessResponse(fetchBackend, environments.frontend.BACKEND_ORIGIN);
    const healthUrl = fetchBackend.mock.calls[0]?.[0];

    expect(new URL(configuredOrigin ?? "http://invalid").port).toBe("4000");
    expect(new URL(String(healthUrl)).port).toBe("4000");
    expect(environments.backend.PORT).toBe("4000");
  });

  test("uses the declared frontend port and relies on platform production mode", () => {
    const defaults = platformProcessEnvironments({});

    expect(defaults.frontend.PORT).toBe("3000");
    expect(defaults.backend.PORT).toBe("4000");
    expect(defaults.backend.NODE_ENV).toBeUndefined();
    expect(defaults.frontend.NEXT_TELEMETRY_DISABLED).toBe("1");

    const production = platformProcessEnvironments({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://platform/commons",
    });
    expect(production.backend.NODE_ENV).toBe("production");
    expect(() => validateDeploymentConfiguration(production.backend)).toThrow(
      "commons: PUBLIC_ORIGIN is required in production.",
    );

    const withOrigin = platformProcessEnvironments({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://platform/commons",
      PUBLIC_ORIGIN: "https://commons.example.edu",
    });
    expect(() => validateDeploymentConfiguration(withOrigin.backend)).toThrow(
      "commons: INVITATION_SECRET is required in production.",
    );

    const complete = platformProcessEnvironments({
      NODE_ENV: "production",
      MONGODB_URI: "mongodb://platform/commons",
      PUBLIC_ORIGIN: "https://commons.example.edu",
      INVITATION_SECRET: "production-invitation-secret",
    });
    expect(() => validateDeploymentConfiguration(complete.backend)).not.toThrow();
  });
});

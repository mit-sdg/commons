import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vite-plus/test";
import { backendReadinessResponse } from "../../frontend/src/lib/health.ts";
import { platformProcessEnvironments } from "../../scripts/start-platform.ts";
import { validateDeploymentConfiguration } from "../../src/deployment.ts";

const root = join(import.meta.dirname, "../..");
describe("the managed-platform deployment", () => {
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

  test("forces production mode and enforces production configuration", () => {
    const defaults = platformProcessEnvironments({});

    expect(defaults.backend.NODE_ENV).toBe("production");
    expect(defaults.frontend.NODE_ENV).toBe("production");
    expect(defaults.frontend.PORT).toBe("3000");
    expect(defaults.backend.PORT).toBe("4000");

    const staleDevelopment = platformProcessEnvironments({
      NODE_ENV: "development",
      PORT: "3210",
      LOG_LEVEL: "warn",
      MONGODB_URI: "mongodb://platform/commons",
    });

    expect(staleDevelopment.backend.NODE_ENV).toBe("production");
    expect(staleDevelopment.frontend.NODE_ENV).toBe("production");
    expect(staleDevelopment.frontend.PORT).toBe("3210");
    expect(staleDevelopment.backend.PORT).toBe("4000");
    expect(staleDevelopment.backend.LOG_LEVEL).toBe("warn");
    expect(staleDevelopment.frontend.LOG_LEVEL).toBe("warn");
    expect(staleDevelopment.frontend.NEXT_TELEMETRY_DISABLED).toBe("1");
    expect(() => validateDeploymentConfiguration(staleDevelopment.backend)).toThrow(
      "commons: PUBLIC_ORIGIN is required in production.",
    );

    const withOrigin = platformProcessEnvironments({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://platform/commons",
      PUBLIC_ORIGIN: "https://commons.example.edu",
    });
    expect(() => validateDeploymentConfiguration(withOrigin.backend)).toThrow(
      "commons: INVITATION_SECRET is required in production.",
    );

    const complete = platformProcessEnvironments({
      NODE_ENV: "development",
      MONGODB_URI: "mongodb://platform/commons",
      PUBLIC_ORIGIN: "https://commons.example.edu",
      INVITATION_SECRET: "production-invitation-secret",
    });
    expect(() => validateDeploymentConfiguration(complete.backend)).not.toThrow();
  });
});

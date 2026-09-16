import { defineConfig, devices } from "@playwright/test";

/**
 * Browser evidence against the real stack: temporary
 * MongoDB, the HTTP edge, the Next.js frontend, and the scripted reasoner.
 */
const EDGE_PORT = 4755;
const WEB_PORT = 3755;
// Keep local iteration fast, but exercise the deployed frontend in CI. Next's
// on-demand dev route discovery can return spurious 404s in a long browser run.
const standalone = Boolean(process.env.CI) || process.env.COMMONS_E2E_STANDALONE === "1";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "firefox-mobile",
      testMatch: "mobile-*.spec.ts",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: standalone
      ? "bun run --cwd frontend build && bun scripts/prepare-platform.ts && bun scripts/stack-mongo.ts"
      : "bun scripts/stack-mongo.ts",
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: standalone ? 300_000 : 180_000,
    env: {
      COMMONS_E2E_STANDALONE: standalone ? "1" : "0",
      BACKEND_ORIGIN: `http://127.0.0.1:${EDGE_PORT}`,
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(EDGE_PORT),
      WEB_PORT: String(WEB_PORT),
      REASONER: "scripted",
      ADMIN_SETUP_SECRET_HASH:
        "$scrypt$N=16384,r=8,p=1$rE/9lc3ruIntPOMyZZ4NEQ==$ad8rsEsjQCpfHuLcDAqj1QVm/v4+QZfe2QQm8XH+Mok=",
    },
  },
});

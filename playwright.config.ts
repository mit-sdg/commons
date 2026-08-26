import { defineConfig, devices } from "@playwright/test";

/**
 * Browser evidence for the live-quiz loop against the real stack: temporary
 * MongoDB, the HTTP edge, the Next.js frontend, and the scripted reasoner.
 */
const EDGE_PORT = 4755;
const WEB_PORT = 3755;

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
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun scripts/stack-mongo.ts",
    url: `http://127.0.0.1:${WEB_PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      PORT: String(EDGE_PORT),
      WEB_PORT: String(WEB_PORT),
      REASONER: "scripted",
      ADMIN_SETUP_SECRET_HASH:
        "$scrypt$N=16384,r=8,p=1$rE/9lc3ruIntPOMyZZ4NEQ==$ad8rsEsjQCpfHuLcDAqj1QVm/v4+QZfe2QQm8XH+Mok=",
    },
  },
});

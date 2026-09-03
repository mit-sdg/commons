import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * The visual tour: the same stack as the e2e room, driven through every
 * relay screen and photographed at three widths for reading beside the
 * design mockups. Run with `bun run tour`; screenshots land in TOUR_OUT.
 */
const EDGE_PORT = 4756;
const WEB_PORT = 3756;
const root = resolve(import.meta.dirname, "../..");

export default defineConfig({
  testDir: ".",
  timeout: 900_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: resolve(root, "test-results/tour"),
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun scripts/stack-mongo.ts",
    cwd: root,
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

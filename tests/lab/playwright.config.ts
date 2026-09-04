import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

/**
 * The wall lab, filmed: the lab page driven from the terminal and recorded at
 * the projector's own size, so a card's flight can be stepped frame by frame.
 * Run with `bun run lab`; the videos land in `test-results/lab`. Only the
 * frontend is needed — the lab replays a recorded run and calls no server.
 * Point LAB_URL at a dev server that is already up to film against that one.
 */
const WEB_PORT = 3757;
const root = resolve(import.meta.dirname, "../..");
const own = process.env.LAB_URL === undefined;
const baseURL = process.env.LAB_URL ?? `http://127.0.0.1:${WEB_PORT}`;

export default defineConfig({
  testDir: ".",
  timeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  outputDir: resolve(root, "test-results/lab"),
  use: {
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 1920, height: 1080 },
    video: { mode: "on", size: { width: 1920, height: 1080 } },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
  webServer: own
    ? {
        command: `bun run --cwd frontend dev -- -p ${WEB_PORT}`,
        cwd: root,
        url: `${baseURL}/lab/wall`,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { BACKEND_ORIGIN: "http://127.0.0.1:4999" },
      }
    : undefined,
});

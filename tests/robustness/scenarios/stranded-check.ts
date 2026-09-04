/**
 * A run left locked with no round open, as the dashboard meets it: the lock is
 * written straight onto the floor, the way a crash between the lock and the
 * publish would leave it, and the screen is asked to open a round.
 *
 *   MONGO_URL=… bun tests/robustness/scenarios/stranded-check.ts
 */

import { type Client, Log, outDir, pages, signIn, sleep, snap } from "../drive.ts";

const ARM = process.argv[2] ?? "stranded-check";
const MONGO_URL = process.env.MONGO_URL ?? "";
const log = new Log(ARM, outDir(ARM));

async function lockOnTheFloor(run: string) {
  const v8 = await import("node:v8");
  v8.startupSnapshot.isBuildingSnapshot = () => false;
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(MONGO_URL);
  try {
    await client.connect();
    await client
      .db()
      .collection("locking.locks")
      .insertOne({ _id: run, lockedAt: new Date() } as never);
  } finally {
    await client.close();
  }
}

async function plan(host: Client) {
  const planned = await host.call<{ relay: string }>("/live/relays/plan", { title: "Stranded" });
  const legs: string[] = [];
  for (const title of ["One word", "Another word"]) {
    const added = await host.call<{ leg: string }>("/live/relays/add-round", {
      relay: planned.relay,
      title,
      prompt: `${title}?`,
      parts: [],
      cap: 0,
      choices: [],
    });
    legs.push(added.leg);
  }
  return { relay: planned.relay, legs };
}

const host = await signIn();
const web = await pages(host, log);

try {
  const { relay } = await plan(host);
  const launched = await host.call<{ run: string }>("/live/relays/launch", { relay });
  await lockOnTheFloor(launched.run);
  log.note(`run ${launched.run} locked on the floor with no round open`);

  const page = await web.staff(`/staff/live/run/${launched.run}`);
  await sleep(2500);
  await page.getByRole("button", { name: /^Open.*One word/ }).click();
  await sleep(8000);
  const said = await page
    .getByText("No round is open, but the run is still locked.")
    .first()
    .isVisible()
    .catch(() => false);
  log.note(`the stranded line reads ${said}`);
  await snap(page, log, "Stranded", [1440]);

  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await sleep(4000);
  const gone = !(await page
    .getByText("No round is open, but the run is still locked.")
    .first()
    .isVisible()
    .catch(() => false));
  log.note(`after the tap the line is gone: ${gone}`);
  await snap(page, log, "Unlocked", [1440]);

  await page.getByRole("button", { name: /^Open.*One word/ }).click();
  await sleep(4000);
  const opened = await page
    .getByRole("button", { name: /^Close.*One word/ })
    .first()
    .isVisible()
    .catch(() => false);
  log.note(`the round opens after the unlock: ${opened}`);
  await snap(page, log, "Opened", [1440]);
  if (!said || !gone || !opened) {
    log.finding({
      kind: "broken",
      title: `the stranded line (${said}), its clearing (${gone}), or the open after it (${opened}) did not stand`,
      steps: "Lock a run on the floor with no round open; tap Open; wait two polls; tap Unlock",
      screenshot: "Stranded@1440.png",
    });
  }
} catch (error) {
  log.finding({
    kind: "broken",
    title: `the scenario stopped: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
    steps: "See the events log",
    error: error instanceof Error ? (error.stack ?? error.message) : String(error),
  });
} finally {
  await web.close();
  log.write();
}

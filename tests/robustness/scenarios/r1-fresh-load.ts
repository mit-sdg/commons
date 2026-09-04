/**
 * R1's follow-up: the same closed run loaded fresh, to say whether the wall
 * the animation left behind is the wall a reload shows. Reads the server's
 * wall for round one and the counts the dashboard and the projector draw.
 *
 *   bun tests/robustness/scenarios/r1-fresh-load.ts <run> [arm-name]
 */

import { Log, outDir, pages, readRun, readWall, signIn, sleep, snap } from "../drive.ts";

const RUN = process.argv[2] ?? "";
const ARM = process.argv[3] ?? "r1-fresh";
const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

try {
  const standing = await readRun(host, RUN);
  const one = standing.run.rounds[0];
  if (one?.round == null) throw new Error("round one never ran in this run");
  const wall = (await readWall(host, one.round)).wall;
  log.note(
    `server: ${JSON.stringify(wall?.piles.map((pile) => [pile.name, pile.count]))} tray ${
      wall?.cards.filter((card) => card.pile === null).length
    }`,
  );

  const dashboard = await web.staff(`/staff/live/run/${RUN}`);
  await sleep(6000);
  await snap(dashboard, log, "FreshDashboard", [1440]);
  const drawn = (await dashboard.evaluate(
    "document.querySelector('main')?.innerText ?? ''",
  )) as string;
  log.note(`dashboard drew: ${drawn.replace(/\n+/g, " | ").slice(0, 600)}`);
} catch (error) {
  log.finding({
    kind: "broken",
    title: `the follow-up stopped: ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`,
    steps: "See the events log",
  });
} finally {
  await web.close();
  log.write();
}

/**
 * R1's second follow-up: on a closed run, tap round one in the strip and
 * watch how long the wall takes to draw the round it was asked for.
 *
 *   bun tests/robustness/scenarios/r1-strip-tap.ts <run> [arm-name]
 */

import { Log, outDir, pages, readRun, readWall, signIn, sleep, snap } from "../drive.ts";

const RUN = process.argv[2] ?? "";
const ARM = process.argv[3] ?? "r1-strip";
const log = new Log(ARM, outDir(ARM));
const host = await signIn();
const web = await pages(host, log);

const counts = (text: string) =>
  [...text.matchAll(/(Examples|Pace|Questions|Odd one out|Stray)\s*\n?\s*(\d+)/g)].map(
    (found) => [found[1], Number(found[2])] as const,
  );

try {
  const standing = await readRun(host, RUN);
  const one = standing.run.rounds[0];
  if (one?.round == null) throw new Error("round one never ran in this run");
  const wall = (await readWall(host, one.round)).wall;
  const truth = (wall?.piles ?? []).reduce((sum, pile) => sum + pile.count, 0);
  log.note(`round one holds ${truth} cards on the server`);

  const dashboard = await web.staff(`/staff/live/run/${RUN}`);
  await sleep(5000);
  await dashboard
    .getByRole("button", { name: /Three verbs/ })
    .first()
    .click();
  const from = Date.now();
  let drawn = 0;
  for (let tick = 0; tick < 60; tick += 1) {
    const text = (await dashboard.evaluate(
      "document.querySelector('main')?.innerText ?? ''",
    )) as string;
    drawn = counts(text).reduce((sum, [, count]) => sum + count, 0);
    log.note(
      `${((Date.now() - from) / 1000).toFixed(1)}s after the tap: ${drawn} of ${truth} drawn`,
    );
    if (drawn >= truth) break;
    await sleep(5000);
  }
  await snap(dashboard, log, "StripTapped", [1440]);
  if (drawn < truth) {
    log.finding({
      kind: "slow",
      title: `tapping round 1 in the strip drew ${drawn} of ${truth} cards in five minutes`,
      steps: "On a closed run showing round 2's wall, tap round 1 in the strip; watch the counts",
      evidence: `drawn ${drawn}, server ${truth}`,
    });
  }
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

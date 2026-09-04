/**
 * R6, the open race. Two staff sessions on one run — a lecturer's laptop and a
 * TA's — ask to open two different rounds in the same tick, a hundred times.
 * Every trial must leave one round open and answer the other with a conflict,
 * every read of the run afterwards must answer, and closing the round must give
 * the run's lock back so the loser's round opens next.
 *
 *   bun tests/robustness/scenarios/r6-open-race.ts [arm-name]
 */

import { type Client, Log, outDir, readRun, type Reply, signIn } from "../drive.ts";

const ARM = process.argv[2] ?? "r6-open-race";
const TRIALS = Number(process.env.TRIALS ?? 100);

const log = new Log(ARM, outDir(ARM));

/** A relay of two rounds that take nothing, so either may open first. */
async function plan(host: Client): Promise<{ relay: string; legs: string[] }> {
  const planned = await host.call<{ relay: string }>("/live/relays/plan", { title: "Open race" });
  if (planned.error) throw new Error(`plan: ${planned.error}`);
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
    if (added.error) throw new Error(`add-round: ${added.error}`);
    legs.push(added.leg);
  }
  return { relay: planned.relay, legs };
}

interface Trial {
  opened: number;
  conflicts: number;
  others: string[];
  readAnswered: boolean;
  openRoundMatches: boolean;
  roundsOpen: number;
  loserOpened: boolean;
  longest: number;
}

async function timedOpen(
  client: Client,
  run: string,
  leg: string,
): Promise<{ reply: Reply<{ round?: string }>; took: number }> {
  const from = Date.now();
  const reply = await client.call<{ round?: string }>("/live/relays/open-round", { run, leg });
  return { reply, took: Date.now() - from };
}

const laptopA = await signIn();
const laptopB = await signIn();

try {
  const { relay, legs } = await plan(laptopA);
  log.note(`relay ${relay} with legs ${JSON.stringify(legs)}`);
  const trials: Trial[] = [];

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const launched = await laptopA.call<{ run: string }>("/live/relays/launch", { relay });
    if (launched.error) throw new Error(`launch on trial ${trial}: ${launched.error}`);
    const run = launched.run;

    const [first, second] = await Promise.all([
      timedOpen(laptopA, run, legs[0] as string),
      timedOpen(laptopB, run, legs[1] as string),
    ]);
    const replies = [first.reply, second.reply];
    const opened = replies.filter((reply) => typeof reply.round === "string");
    const conflicts = replies.filter((reply) => reply.error === "CONFLICT");
    const others = replies
      .map((reply) => reply.error)
      .filter((error): error is string => error !== undefined && error !== "CONFLICT");

    const read = await readRun(laptopA, run);
    const ran = read.run?.rounds.filter((round) => round.round !== null) ?? [];
    const openRound = read.run?.openRound ?? null;
    const winner = opened[0]?.round ?? null;

    let loserOpened = false;
    if (winner !== null) {
      const closed = await laptopB.call("/live/relays/close-round", { round: winner });
      if (closed.error) log.refused("close-round refused", `trial ${trial}`, closed);
      const loser = ran[0]?.leg === legs[0] ? legs[1] : legs[0];
      const next = await laptopB.call<{ round?: string }>("/live/relays/open-round", {
        run,
        leg: loser as string,
      });
      loserOpened = typeof next.round === "string";
      if (!loserOpened)
        log.refused("the loser's round did not open after the close", `trial ${trial}`, next);
    }
    await laptopA.call("/live/relays/close", { run });

    trials.push({
      opened: opened.length,
      conflicts: conflicts.length,
      others,
      readAnswered: read.error === undefined && read.run !== null,
      openRoundMatches: openRound === winner,
      roundsOpen: ran.length,
      loserOpened,
      longest: Math.max(first.took, second.took),
    });
    if ((trial + 1) % 20 === 0) log.note(`${trial + 1} trials`);
  }

  const wrong = trials.filter(
    (one) =>
      one.opened !== 1 ||
      one.conflicts !== 1 ||
      one.others.length > 0 ||
      !one.readAnswered ||
      !one.openRoundMatches ||
      one.roundsOpen !== 1 ||
      !one.loserOpened,
  );
  const longest = Math.max(...trials.map((one) => one.longest));
  log.note(
    `${trials.length} trials: ${trials.length - wrong.length} clean, longest open-round request ${longest}ms`,
  );
  if (wrong.length > 0) {
    log.finding({
      kind: "broken",
      title: `${wrong.length} of ${trials.length} open races did not leave exactly one round open`,
      steps:
        "Two signed-in staff clients ask to open two rounds of one run in the same tick; read the run; close the round; open the loser's round",
      evidence: JSON.stringify(wrong.slice(0, 5)),
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
  log.write();
}

/**
 * Seed one class for rehearsing team submissions into a running Commons
 * stack, on a moved clock so due dates and papers fall in the past. Start a
 * stack whose MongoDB address you know, then seed it:
 *
 *   PORT=4290 WEB_PORT=3290 bun tests/e2e/support/course-stack.ts
 *   bun tests/e2e/support/seed-team-scenario.ts --mongodb-url mongodb://127.0.0.1:27290/commons-course --origin http://127.0.0.1:3290 [--no-check]
 *
 * The seed writes through an edge in this process over the stack's database;
 * the checks then read the stack back over HTTP at `--origin` and fail the
 * run when the class differs from what was seeded. Prints one JSON object:
 * every account's name, username, password, role, and team, and each
 * assignment's title and id. Progress goes to stderr. Meant for a fresh
 * stack, since Commons has one class.
 */
import { checkTeamScenario, seedTeamScenario } from "./team-scenario.ts";

const usage =
  "usage: bun tests/e2e/support/seed-team-scenario.ts --mongodb-url mongodb://127.0.0.1:27290/commons-course [--origin http://127.0.0.1:3290] [--no-check]";

const args = process.argv.slice(2);
let origin = "http://127.0.0.1:3000";
let mongodbUrl: string | null = null;
let check = true;
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index] as string;
  const [flag, inline] = arg.includes("=") ? arg.split("=", 2) : [arg, undefined];
  const value = () => {
    if (inline !== undefined) return inline;
    index += 1;
    return args[index];
  };
  if (flag === "--origin") origin = value() ?? origin;
  else if (flag === "--mongodb-url") mongodbUrl = value() ?? null;
  else if (flag === "--no-check") check = false;
  else {
    console.error(`unknown argument "${arg}"\n${usage}`);
    process.exit(2);
  }
}
if (mongodbUrl === null || !/^mongodb(\+srv)?:\/\/[^/]+\/[^/?#]+/.test(mongodbUrl)) {
  console.error(
    `--mongodb-url must name a database, as in mongodb://127.0.0.1:27290/commons-course\n${usage}`,
  );
  process.exit(2);
}

const started = Date.now();
const seeded = await seedTeamScenario(mongodbUrl, origin, {
  progress: (line) => console.error(`[seed] ${line}`),
});
const seconds = (Date.now() - started) / 1000;
const checks = check ? await checkTeamScenario(seeded) : null;
console.log(JSON.stringify({ ...seeded, seconds, checks }));
if (checks && checks.failed.length > 0) {
  console.error(`[seed] ${checks.failed.length} checks failed:\n${checks.failed.join("\n")}`);
  process.exit(1);
}
// The in-process edge may leave timers behind; the seed is done.
process.exit(0);

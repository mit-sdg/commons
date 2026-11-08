/**
 * Seed a whole course so far into a running Commons stack, for rehearsing
 * late days, lecture attendance, and course grades together.
 *
 * Over HTTP, every action stamped by the stack's clock (so every due date and
 * every lecture falls on today):
 *
 *   bun tests/e2e/support/seed-course-scenario.ts [--students 60] [--origin http://127.0.0.1:3000] [--no-release] [--no-check]
 *
 * On a moved clock, through an edge in this process over the stack's database,
 * so the term runs about eleven weeks back to yesterday. Start a stack whose
 * MongoDB address you know, then seed it:
 *
 *   PORT=4190 WEB_PORT=3190 bun tests/e2e/support/course-stack.ts
 *   bun tests/e2e/support/seed-course-scenario.ts --mongodb-url mongodb://127.0.0.1:27190/commons-course --origin http://127.0.0.1:3190 [--students 60]
 *
 * Either way the checks then read the stack back over HTTP at `--origin`.
 * Prints one JSON object: every account's username and password, and the ids
 * a rehearsal needs. Progress goes to stderr. Meant for a fresh stack, since
 * Commons has one class.
 */
import {
  checkCourseScenario,
  seedCourseScenario,
  seedCourseScenarioOnClock,
} from "./course-scenario.ts";

const usage =
  "usage: bun tests/e2e/support/seed-course-scenario.ts [--students 60] [--origin http://127.0.0.1:3000] [--mongodb-url mongodb://127.0.0.1:27190/commons-course] [--no-release] [--no-check]";

const args = process.argv.slice(2);
let origin = "http://127.0.0.1:3000";
let mongodbUrl: string | null = null;
let students = 60;
let release = true;
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
  else if (flag === "--students") students = Number(value());
  else if (flag === "--no-release") release = false;
  else if (flag === "--no-check") check = false;
  else {
    console.error(`unknown argument "${arg}"\n${usage}`);
    process.exit(2);
  }
}
if (!Number.isInteger(students) || students < 12) {
  console.error(`--students must be a whole number of at least 12\n${usage}`);
  process.exit(2);
}
if (mongodbUrl !== null && !/^mongodb(\+srv)?:\/\/[^/]+\/[^/?#]+/.test(mongodbUrl)) {
  console.error(
    `--mongodb-url must name a database, as in mongodb://127.0.0.1:27190/commons-course\n${usage}`,
  );
  process.exit(2);
}

const options = { students, release, progress: (line: string) => console.error(`[seed] ${line}`) };
const started = Date.now();
const seeded =
  mongodbUrl === null
    ? await seedCourseScenario(origin, options)
    : await seedCourseScenarioOnClock(mongodbUrl, origin, options);
const seconds = (Date.now() - started) / 1000;
const checks = check ? await checkCourseScenario(seeded) : null;
console.log(JSON.stringify({ ...seeded, seconds, checks }));
// The in-process edge may leave timers behind; the seed is done.
process.exit(0);

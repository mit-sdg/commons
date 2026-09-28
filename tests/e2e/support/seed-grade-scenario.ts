/**
 * Seed graded assignments into a running Commons stack for the Grades tab.
 *
 *   bun tests/e2e/support/seed-grade-scenario.ts <scenario|all> [--origin http://127.0.0.1:3000]
 *
 * Prints one JSON line per scenario. `setup-edited` seeds both
 * `setup-edited-points` and `setup-edited-rubric`.
 */
import {
  isScenarioName,
  SCENARIOS,
  type ScenarioName,
  seedGradeScenario,
} from "./grade-scenarios.ts";

const args = process.argv.slice(2);
let origin = "http://127.0.0.1:3000";
const names: string[] = [];
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index] as string;
  if (arg === "--origin") {
    origin = args[index + 1] ?? origin;
    index += 1;
  } else if (arg.startsWith("--origin=")) origin = arg.slice("--origin=".length);
  else names.push(arg);
}

const usage = `usage: bun tests/e2e/support/seed-grade-scenario.ts <${["all", "setup-edited", ...SCENARIOS].join("|")}> [--origin http://127.0.0.1:3000]`;
if (names.length === 0) {
  console.error(usage);
  process.exit(2);
}

const chosen: ScenarioName[] = names.flatMap((name): ScenarioName[] => {
  if (name === "all") return [...SCENARIOS];
  if (name === "setup-edited") return ["setup-edited-points", "setup-edited-rubric"];
  if (isScenarioName(name)) return [name];
  console.error(`unknown scenario "${name}"\n${usage}`);
  process.exit(2);
});

for (const name of chosen) {
  const started = Date.now();
  const seeded = await seedGradeScenario(origin, name);
  console.log(JSON.stringify({ ...seeded, seconds: (Date.now() - started) / 1000 }));
}

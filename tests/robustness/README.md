# Manual classroom scenarios

These scripts exercise real classroom workflows over HTTP and Chromium. They
complement the automated tests under `tests/app`, `tests/concepts`, and `tests/e2e`.
`bun run test` does not run the scenario scripts. It does run `drive.test.ts`,
which checks the scenario helper's completion and failure reporting.

## Run against a disposable local stack

Use Node 24, the repository's Bun version, installed root/frontend dependencies,
and Chromium (`bunx playwright install chromium`). From a clean candidate checkout:

```sh
REASONER=scripted bun dev
```

This creates temporary MongoDB and seeded demo accounts. Use a checkout without
`.env` overrides and unset external MongoDB/deployment variables first.
Do not point the stack at a classroom database: scenarios create and change data,
and the stranded-lock scenario deliberately inserts a lock directly into MongoDB.
Stop the stack with Ctrl-C when finished.

In another terminal, run a scenario with a unique output name:

```sh
bun tests/robustness/scenarios/r6-open-race.ts candidate-open-race
bun tests/robustness/scenarios/three-verbs.ts candidate-three-verbs
```

The defaults are `EDGE=http://127.0.0.1:4000`, `WEB=http://127.0.0.1:3000`,
and the seeded `mara` account. Set EDGE and WEB when using other ports.
For database inspection, set `MONGO_URL` to the temporary URI printed by the
stack. This harness variable differs from the application's `MONGODB_URL`.
`stranded-check.ts` requires it; other scripts use it only where documented.
R1 fresh-load and strip-tap require an existing run ID before the output name.
Phase 0 accepts an output directory instead; its default is `test-results/robustness/phase0`.

Prefer the scripted reasoner for repeatable workflow checks. Live-provider runs
need deliberate provider configuration and a specific prompt/behavior to assess;
they consume provider quota and their latency is not a correctness assertion.

## Read the result

Each run writes screenshots and `findings.json` under
`test-results/robustness/<output-name>/`. Preserve these outside Git.

- `failed`: a broken behavior or unexpected refusal; the process exits nonzero.
- `review`: only timing, visual, or clarity observations remain. Inspect them;
  exit zero does not certify that these observations are acceptable.
- `passed`: no findings were recorded.

An uncaught setup error also exits nonzero and may precede report creation.
Expected refusals must be checked explicitly by the scenario, not hidden by
blanket filtering. A populated wall does not prove completion: waits that require
settled sorting also check `asksOut === 0` and `sortPending === false`.

Switching automatic sorting off does not cancel admitted work. Closing a round
can finish sorting. Tests should preserve those accepted behaviors while checking
that human submissions and captured presentations remain unchanged.

## Suite ownership and validation

Maintain these reusable scripts here. The local `release-testing` branch retains
copies plus R9–R20 and investigation harnesses; it is not another application
candidate. Carry selected test changes there, never merge its application history
into a release. Run additional harnesses over a clean export of the candidate.

The separate `bun run tour` command starts its own scripted stack and captures
staff, projector, and phone screens in light/dark themes at several widths.
It is a walkthrough with assertions, not an automated screenshot comparison.
Outputs go to `test-results/tour-shots` (override with `TOUR_OUT`). Do not run it
alongside another Next dev server in the same checkout; use separate exports.

For each candidate, retain its commit, testing changes, provider mode, scenario
names, verdicts, and unresolved findings. A passing related E2E or an older run
does not certify an unexecuted script. Start with open races, late phones,
three-round source carry, and recovery; add runoff, multi-dashboard, retirement,
and visual checks according to the changes under review.

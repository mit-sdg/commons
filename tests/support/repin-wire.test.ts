/**
 * Re-record the observed responses of the wire fixtures.
 *
 * The steps are authored; the responses are whatever the assembly actually
 * returns. This is inert unless REPIN_WIRE names fixtures to rewrite, because it
 * replaces expectations — always read the resulting diff, since it can absorb a
 * regression as easily as an intended change.
 *
 *   REPIN_WIRE="tests/wire/fixtures/grades-gradebook.json" vp test repin-wire
 */
import { readFileSync, writeFileSync } from "node:fs";
import { describe, test } from "vite-plus/test";
import { runWireFixture, type WireFixture } from "./wire.ts";

const targets = (process.env.REPIN_WIRE ?? "").split(/[\s,]+/).filter((entry) => entry.length > 0);

describe("wire fixture repinning", () => {
  test.skipIf(targets.length === 0)("records observed responses", async () => {
    for (const file of targets) {
      const fixture = JSON.parse(readFileSync(file, "utf8")) as WireFixture;
      const observed = await runWireFixture(fixture);
      fixture.steps.forEach((step, index) => {
        step.response = observed[index];
      });
      writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
      console.log(`repinned ${file} (${fixture.steps.length} steps)`);
    }
  });
});

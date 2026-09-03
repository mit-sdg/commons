import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/relaying/errors.ts";
import { MongoRelayingConcept } from "../../src/concepts/relaying/relaying.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MongoRelayingConcept>][] = [
  ["on MongoDB", async () => new MongoRelayingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;
const at = new Date("2026-09-02T10:00:00.000Z");

async function relayOfThree(relaying: MongoRelayingConcept) {
  const { relay } = await relaying.plan({ author: "dana", title: "Concept clinic", at });
  const { leg: first } = await relaying.addLeg({ relay, material: "name-it" });
  const { leg: second } = await relaying.addLeg({ relay, material: "vote" });
  const { leg: third } = await relaying.addLeg({ relay, material: "explain" });
  return { relay, first, second, third };
}

for (const [floor, make] of floors) {
  describe(`Relaying ${floor}`, () => {
    test("plan records the author, the normalized title, and the moment", async () => {
      const relaying = await make();
      const { relay } = await relaying.plan({ author: "dana", title: "  Concept clinic  ", at });
      expect(await relaying._relay({ relay })).toEqual([
        { author: "dana", title: "Concept clinic", createdAt: at },
      ]);
      expect(await relaying._relay({ relay: "ghost" })).toEqual([]);
    });

    test("plan refuses a blank or overlong title", async () => {
      const relaying = await make();
      expect(
        await refusalOf(() => relaying.plan({ author: "dana", title: "   ", at })),
      ).toBeInstanceOf(refusalErrors.InvalidTitle);
      expect(
        await refusalOf(() => relaying.plan({ author: "dana", title: "x".repeat(201), at })),
      ).toBeInstanceOf(refusalErrors.InvalidTitle);
      expect(await relaying.plan({ author: "dana", title: "x".repeat(200), at })).toHaveProperty(
        "relay",
      );
    });

    test("_relays answers every relay, newest first", async () => {
      const relaying = await make();
      const early = new Date("2026-09-01T10:00:00.000Z");
      const { relay: first } = await relaying.plan({ author: "dana", title: "First", at: early });
      const { relay: second } = await relaying.plan({ author: "dana", title: "Second", at });
      const { relay: third } = await relaying.plan({ author: "ada", title: "Third", at });
      expect((await relaying._relays({})).map((row) => row.relay)).toEqual([third, second, first]);
      expect(await relaying._relays({})).toContainEqual({
        relay: first,
        author: "dana",
        title: "First",
        createdAt: early,
      });
    });

    test("retitle sets the title and refuses a missing relay or an invalid title", async () => {
      const relaying = await make();
      const { relay } = await relaying.plan({ author: "dana", title: "Concept clinic", at });
      expect(await relaying.retitle({ relay, title: "  Rounds  " })).toEqual({ relay });
      expect(await relaying._relay({ relay })).toEqual([
        { author: "dana", title: "Rounds", createdAt: at },
      ]);
      expect(
        await refusalOf(() => relaying.retitle({ relay: "ghost", title: "Rounds" })),
      ).toBeInstanceOf(refusalErrors.RelayNotFound);
      expect(await refusalOf(() => relaying.retitle({ relay, title: " " }))).toBeInstanceOf(
        refusalErrors.InvalidTitle,
      );
    });

    test("addLeg appends contiguously from one and refuses a missing relay", async () => {
      const relaying = await make();
      const { relay } = await relaying.plan({ author: "dana", title: "Concept clinic", at });
      const first = await relaying.addLeg({ relay, material: "name-it" });
      const second = await relaying.addLeg({ relay, material: "vote" });
      expect(first.position).toBe(1);
      expect(second.position).toBe(2);
      expect(await relaying._legs({ relay })).toEqual([
        { leg: first.leg, material: "name-it", position: 1 },
        { leg: second.leg, material: "vote", position: 2 },
      ]);
      expect(await relaying._leg({ leg: second.leg })).toEqual([
        { relay, material: "vote", position: 2 },
      ]);
      expect(await relaying._leg({ leg: "ghost" })).toEqual([]);
      expect(await relaying._legFor({ material: "vote" })).toEqual([
        { leg: second.leg, relay, position: 2 },
      ]);
      expect(await relaying._legFor({ material: "nothing" })).toEqual([]);
      expect(
        await refusalOf(() => relaying.addLeg({ relay: "ghost", material: "x" })),
      ).toBeInstanceOf(refusalErrors.RelayNotFound);
    });

    test("_legs answers no rows for a relay with none", async () => {
      const relaying = await make();
      const { relay } = await relaying.plan({ author: "dana", title: "Concept clinic", at });
      expect(await relaying._legs({ relay })).toEqual([]);
      expect(await relaying._legs({ relay: "ghost" })).toEqual([]);
    });

    test("draw joins a leg to an earlier sibling and drawing again sets the shape", async () => {
      const relaying = await make();
      const { first, second, third } = await relayOfThree(relaying);
      const { draw } = await relaying.draw({ leg: second, source: first, shape: "piles" });
      const { draw: again } = await relaying.draw({
        leg: second,
        source: first,
        shape: "three piles",
      });
      expect(again).toBe(draw);
      expect(await relaying._draws({ leg: second })).toEqual([
        { draw, source: first, shape: "three piles" },
      ]);
      const { draw: later } = await relaying.draw({ leg: third, source: first, shape: "winner" });
      expect(await relaying._drawsOn({ source: first })).toEqual([
        { draw, leg: second, shape: "three piles" },
        { draw: later, leg: third, shape: "winner" },
      ]);
      expect(await relaying._draws({ leg: first })).toEqual([]);
      expect(await relaying._drawsOn({ source: third })).toEqual([]);
    });

    test("drawing again on another source moves the leg's one draw there", async () => {
      const relaying = await make();
      const { first, second, third } = await relayOfThree(relaying);
      const { draw } = await relaying.draw({ leg: third, source: first, shape: "names" });
      const { draw: again } = await relaying.draw({ leg: third, source: second, shape: "winner" });
      expect(again).toBe(draw);
      expect(await relaying._draws({ leg: third })).toEqual([
        { draw, source: second, shape: "winner" },
      ]);
      expect(await relaying._drawsOn({ source: first })).toEqual([]);
    });

    test("draw refuses a missing leg, a stranger, a forward draw, and a blank shape", async () => {
      const relaying = await make();
      const { first, second } = await relayOfThree(relaying);
      const { relay: other } = await relaying.plan({ author: "ada", title: "Other", at });
      const { leg: stranger } = await relaying.addLeg({ relay: other, material: "elsewhere" });

      expect(
        await refusalOf(() => relaying.draw({ leg: "ghost", source: first, shape: "x" })),
      ).toBeInstanceOf(refusalErrors.LegNotFound);
      expect(
        await refusalOf(() => relaying.draw({ leg: second, source: "ghost", shape: "x" })),
      ).toBeInstanceOf(refusalErrors.LegNotFound);
      expect(
        await refusalOf(() => relaying.draw({ leg: second, source: stranger, shape: "x" })),
      ).toBeInstanceOf(refusalErrors.NotSiblings);
      expect(
        await refusalOf(() => relaying.draw({ leg: first, source: second, shape: "x" })),
      ).toBeInstanceOf(refusalErrors.ForwardDraw);
      expect(
        await refusalOf(() => relaying.draw({ leg: first, source: first, shape: "x" })),
      ).toBeInstanceOf(refusalErrors.ForwardDraw);
      expect(
        await refusalOf(() => relaying.draw({ leg: second, source: first, shape: "  " })),
      ).toBeInstanceOf(refusalErrors.InvalidShape);
      expect(await relaying._draws({ leg: second })).toEqual([]);
    });

    test("undraw removes the draw and refuses when none joins the pair", async () => {
      const relaying = await make();
      const { first, second } = await relayOfThree(relaying);
      await relaying.draw({ leg: second, source: first, shape: "piles" });
      expect(await relaying.undraw({ leg: second, source: first })).toEqual({ leg: second });
      expect(await relaying._draws({ leg: second })).toEqual([]);
      expect(await refusalOf(() => relaying.undraw({ leg: second, source: first }))).toBeInstanceOf(
        refusalErrors.NoDraw,
      );
    });

    test("moveLeg shifts the legs between the old and the new place", async () => {
      const relaying = await make();
      const { relay, first, second, third } = await relayOfThree(relaying);
      expect(await relaying.moveLeg({ leg: third, position: 1 })).toEqual({
        leg: third,
        position: 1,
      });
      expect((await relaying._legs({ relay })).map((row) => row.leg)).toEqual([
        third,
        first,
        second,
      ]);
      await relaying.moveLeg({ leg: third, position: 3 });
      expect((await relaying._legs({ relay })).map((row) => row.leg)).toEqual([
        first,
        second,
        third,
      ]);
      expect(await relaying.moveLeg({ leg: second, position: 2 })).toEqual({
        leg: second,
        position: 2,
      });
      expect(await relaying._legs({ relay })).toEqual([
        { leg: first, material: "name-it", position: 1 },
        { leg: second, material: "vote", position: 2 },
        { leg: third, material: "explain", position: 3 },
      ]);
    });

    test("moveLeg refuses a missing leg and a place the relay does not have", async () => {
      const relaying = await make();
      const { first } = await relayOfThree(relaying);
      expect(await refusalOf(() => relaying.moveLeg({ leg: "ghost", position: 1 }))).toBeInstanceOf(
        refusalErrors.LegNotFound,
      );
      expect(await refusalOf(() => relaying.moveLeg({ leg: first, position: 0 }))).toBeInstanceOf(
        refusalErrors.NoSuchPosition,
      );
      expect(await refusalOf(() => relaying.moveLeg({ leg: first, position: 4 }))).toBeInstanceOf(
        refusalErrors.NoSuchPosition,
      );
    });

    test("moveLeg refuses an order that would put a leg before what it draws on", async () => {
      const relaying = await make();
      const { relay, first, second, third } = await relayOfThree(relaying);
      await relaying.draw({ leg: third, source: second, shape: "winner" });
      expect(await refusalOf(() => relaying.moveLeg({ leg: third, position: 1 }))).toBeInstanceOf(
        refusalErrors.ForwardDraw,
      );
      expect(await refusalOf(() => relaying.moveLeg({ leg: second, position: 3 }))).toBeInstanceOf(
        refusalErrors.ForwardDraw,
      );
      expect((await relaying._legs({ relay })).map((row) => row.leg)).toEqual([
        first,
        second,
        third,
      ]);
      expect(await relaying.moveLeg({ leg: first, position: 3 })).toEqual({
        leg: first,
        position: 3,
      });
      expect((await relaying._legs({ relay })).map((row) => row.leg)).toEqual([
        second,
        third,
        first,
      ]);
    });

    test("removeLeg closes the ranks, takes its own draws, and refuses when one is drawn on", async () => {
      const relaying = await make();
      const { relay, first, second, third } = await relayOfThree(relaying);
      await relaying.draw({ leg: second, source: first, shape: "piles" });
      await relaying.draw({ leg: third, source: first, shape: "winner" });

      expect(await refusalOf(() => relaying.removeLeg({ leg: first }))).toBeInstanceOf(
        refusalErrors.LegDrawnOn,
      );
      expect(await refusalOf(() => relaying.removeLeg({ leg: "ghost" }))).toBeInstanceOf(
        refusalErrors.LegNotFound,
      );

      expect(await relaying.removeLeg({ leg: second })).toEqual({
        leg: second,
        relay,
        material: "vote",
      });
      expect(await relaying._legs({ relay })).toEqual([
        { leg: first, material: "name-it", position: 1 },
        { leg: third, material: "explain", position: 2 },
      ]);
      expect(await relaying._drawsOn({ source: first })).toEqual([
        { draw: expect.any(String), leg: third, shape: "winner" },
      ]);
      expect(await relaying._draws({ leg: second })).toEqual([]);
      expect(await relaying._leg({ leg: second })).toEqual([]);

      await relaying.undraw({ leg: third, source: first });
      expect(await relaying.removeLeg({ leg: first })).toEqual({
        leg: first,
        relay,
        material: "name-it",
      });
      expect(await relaying._legs({ relay })).toEqual([
        { leg: third, material: "explain", position: 1 },
      ]);
    });

    test("addLeg appends after the ranks close", async () => {
      const relaying = await make();
      const { relay, first } = await relayOfThree(relaying);
      await relaying.removeLeg({ leg: first });
      const { position } = await relaying.addLeg({ relay, material: "reflect" });
      expect(position).toBe(3);
      expect((await relaying._legs({ relay })).map((row) => row.position)).toEqual([1, 2, 3]);
    });

    test("_plan answers the relay's legs with their draws in one row", async () => {
      const relaying = await make();
      const { relay, first, second, third } = await relayOfThree(relaying);
      await relaying.draw({ leg: second, source: first, shape: "piles" });
      await relaying.draw({ leg: third, source: second, shape: "winner" });
      expect(await relaying._plan({ relay })).toEqual([
        {
          legs: [
            { leg: first, material: "name-it", position: 1, draws: [] },
            {
              leg: second,
              material: "vote",
              position: 2,
              draws: [{ source: first, shape: "piles" }],
            },
            {
              leg: third,
              material: "explain",
              position: 3,
              draws: [{ source: second, shape: "winner" }],
            },
          ],
        },
      ]);
    });

    test("_plan answers an empty sequence for a relay with no legs and no row for none", async () => {
      const relaying = await make();
      const { relay } = await relaying.plan({ author: "dana", title: "Concept clinic", at });
      expect(await relaying._plan({ relay })).toEqual([{ legs: [] }]);
      expect(await relaying._plan({ relay: "ghost" })).toEqual([]);
    });

    test("a relay keeps its legs apart from another relay's", async () => {
      const relaying = await make();
      const { relay: mine, first } = await relayOfThree(relaying);
      const { relay: yours } = await relaying.plan({ author: "ada", title: "Other", at });
      await relaying.addLeg({ relay: yours, material: "elsewhere" });
      expect(await relaying._legs({ relay: yours })).toEqual([
        { leg: expect.any(String), material: "elsewhere", position: 1 },
      ]);
      expect((await relaying._legs({ relay: mine })).map((row) => row.leg)).toContain(first);
    });
  });
}

import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/reasoning/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoReasoningConcept } from "../../src/concepts/reasoning/reasoning.mongo.ts";

const floors: [string, () => Promise<MongoReasoningConcept>][] = [
  ["on MongoDB", async () => new MongoReasoningConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Reasoning ${floor}`, () => {
    const at = new Date("2026-03-01T09:00:00Z");
    const later = new Date("2026-03-01T09:00:04Z");

    test("ask stands pending with its passage until answered", async () => {
      const reasoning = await make();
      const { asking } = await reasoning.ask({
        reasoner: "flash",
        about: "brief-1",
        passage: "Draft a quiz.",
        at,
      });
      expect(await reasoning._pending()).toEqual([
        { asking, reasoner: "flash", about: "brief-1", passage: "Draft a quiz.", askedAt: at },
      ]);
      expect(await reasoning._asking({ asking })).toEqual([
        {
          reasoner: "flash",
          about: "brief-1",
          passage: "Draft a quiz.",
          askedAt: at,
          pending: true,
        },
      ]);
      await reasoning.answer({ asking, reply: '{"kind":"draft"}', at: later });
      expect(await reasoning._pending()).toEqual([]);
      expect(await reasoning._replyOf({ asking })).toEqual([
        { reply: '{"kind":"draft"}', answeredAt: later },
      ]);
      expect(await reasoning._failureOf({ asking })).toEqual([]);
    });

    test("fail settles the ask with an account instead of a reply", async () => {
      const reasoning = await make();
      const { asking } = await reasoning.ask({
        reasoner: "flash",
        about: "brief-2",
        passage: "Draft a quiz.",
        at,
      });
      await reasoning.fail({ asking, account: "The reasoner could not be reached.", at: later });
      expect(await reasoning._pending()).toEqual([]);
      expect(await reasoning._failureOf({ asking })).toEqual([
        { account: "The reasoner could not be reached.", failedAt: later },
      ]);
      expect(await reasoning._replyOf({ asking })).toEqual([]);
    });

    test("an asking settles exactly once", async () => {
      const reasoning = await make();
      const { asking } = await reasoning.ask({
        reasoner: "flash",
        about: "brief-3",
        passage: "p",
        at,
      });
      await reasoning.answer({ asking, reply: "r", at: later });
      expect(
        await refusal(() => reasoning.answer({ asking, reply: "again", at: later })),
      ).toBeInstanceOf(refusalErrors.AlreadySettled);
      expect(
        await refusal(() => reasoning.fail({ asking, account: "x", at: later })),
      ).toBeInstanceOf(refusalErrors.AlreadySettled);
      expect(
        await refusal(() => reasoning.answer({ asking: "no-such", reply: "r", at: later })),
      ).toBeInstanceOf(refusalErrors.AskingNotFound);
    });

    test("pending askings answer oldest first", async () => {
      const reasoning = await make();
      const first = await reasoning.ask({ reasoner: "flash", about: "a", passage: "1", at });
      const second = await reasoning.ask({ reasoner: "flash", about: "a", passage: "2", at });
      expect((await reasoning._pending()).map((row) => row.asking)).toEqual([
        first.asking,
        second.asking,
      ]);
    });

    test("replies about a subject answer newest first, and both stand", async () => {
      const reasoning = await make();
      const one = await reasoning.ask({ reasoner: "flash", about: "brief-9", passage: "p1", at });
      await reasoning.answer({ asking: one.asking, reply: "first reply", at });
      const two = await reasoning.ask({ reasoner: "flash", about: "brief-9", passage: "p2", at });
      await reasoning.answer({ asking: two.asking, reply: "second reply", at: later });
      const other = await reasoning.ask({
        reasoner: "flash",
        about: "elsewhere",
        passage: "p",
        at,
      });
      await reasoning.answer({ asking: other.asking, reply: "off-topic", at: later });
      expect(await reasoning._repliesAbout({ about: "brief-9" })).toEqual([
        {
          asking: two.asking,
          reasoner: "flash",
          passage: "p2",
          reply: "second reply",
          answeredAt: later,
        },
        {
          asking: one.asking,
          reasoner: "flash",
          passage: "p1",
          reply: "first reply",
          answeredAt: at,
        },
      ]);
    });
  });
}

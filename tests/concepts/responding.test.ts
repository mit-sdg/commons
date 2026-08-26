import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/responding/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoRespondingConcept } from "../../src/concepts/responding/responding.mongo.ts";

const floors: [string, () => Promise<MongoRespondingConcept>][] = [
  ["on MongoDB", async () => new MongoRespondingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

for (const [floor, make] of floors) {
  describe(`Responding ${floor}`, () => {
    const at = new Date("2026-03-03T09:00:00Z");
    const later = new Date("2026-03-03T09:30:00Z");

    test("begin records the subject, participant, and start, unsubmitted", async () => {
      const responding = await make();
      const { response } = await responding.begin({
        participant: "leon",
        subject: "quiz",
        at,
      });
      expect(await responding._response({ response })).toEqual([
        {
          subject: "quiz",
          participant: "leon",
          submitted: false,
          startedAt: at,
          submittedAt: null,
        },
      ]);
      expect(await responding._responseFor({ subject: "quiz", participant: "leon" })).toEqual([
        { response, submitted: false },
      ]);
    });

    test("a blank participant identity is refused", async () => {
      const responding = await make();
      expect(
        await refusal(() => responding.begin({ participant: "", subject: "run-1", at })),
      ).toBeInstanceOf(refusalErrors.NoParticipant);
      expect(
        await refusal(() => responding.begin({ participant: "   ", subject: "run-1", at })),
      ).toBeInstanceOf(refusalErrors.NoParticipant);
    });

    test("beginning again rejoins the response in progress, answers standing", async () => {
      const responding = await make();
      const first = await responding.begin({ participant: "leon", subject: "quiz", at });
      await responding.answer({ response: first.response, item: "q1", value: "a" });
      const again = await responding.begin({ participant: "leon", subject: "quiz", at: later });
      expect(again.response).toBe(first.response);
      expect(await responding._answers({ response: first.response })).toEqual([
        { item: "q1", value: "a" },
      ]);
      expect((await responding._response({ response: first.response }))[0]?.startedAt).toEqual(at);
    });

    test("answers keep first-answer order, and answering again replaces in place", async () => {
      const responding = await make();
      const { response } = await responding.begin({ participant: "leon", subject: "quiz", at });
      await responding.answer({ response, item: "q1", value: "a" });
      await responding.answer({ response, item: "q2", value: "b" });
      await responding.answer({ response, item: "q3", value: "c" });
      const changed = await responding.answer({ response, item: "q1", value: "z" });
      expect(changed).toEqual({ response });
      expect(await responding._answers({ response })).toEqual([
        { item: "q1", value: "z" },
        { item: "q2", value: "b" },
        { item: "q3", value: "c" },
      ]);
    });

    test("submit fixes the response, and nothing more is accepted", async () => {
      const responding = await make();
      const { response } = await responding.begin({ participant: "leon", subject: "quiz", at });
      await responding.answer({ response, item: "q1", value: "a" });
      expect(await responding.submit({ response, at: later })).toEqual({ response });
      expect(await responding._response({ response })).toEqual([
        {
          subject: "quiz",
          participant: "leon",
          submitted: true,
          startedAt: at,
          submittedAt: later,
        },
      ]);
      for (const change of [
        () => responding.answer({ response, item: "q2", value: "b" }),
        () => responding.submit({ response, at: later }),
        () => responding.begin({ participant: "leon", subject: "quiz", at: later }),
      ]) {
        const err = await refusal(change);
        expect(err).toBeInstanceOf(refusalErrors.AlreadySubmitted);
      }
    });

    test("answering or submitting an unknown response refuses", async () => {
      const responding = await make();
      for (const change of [
        () => responding.answer({ response: "none", item: "q1", value: "a" }),
        () => responding.submit({ response: "none", at }),
      ]) {
        const err = await refusal(change);
        expect(err).toBeInstanceOf(refusalErrors.ResponseNotFound);
      }
    });

    test("_responsesFor answers the subject's responses, earliest begun first", async () => {
      const responding = await make();
      const late = await responding.begin({ participant: "mira", subject: "quiz", at: later });
      const early = await responding.begin({ participant: "leon", subject: "quiz", at });
      await responding.begin({ participant: "leon", subject: "survey", at: later });
      await responding.submit({ response: early.response, at: later });
      expect(await responding._responsesFor({ subject: "quiz" })).toEqual([
        {
          response: early.response,
          participant: "leon",
          submitted: true,
          startedAt: at,
          submittedAt: later,
        },
        {
          response: late.response,
          participant: "mira",
          submitted: false,
          startedAt: later,
          submittedAt: null,
        },
      ]);
      expect(await responding._responsesFor({ subject: "no-such" })).toEqual([]);
    });

    test("_collectedAnswers hands over one ordered sequence, empty when nothing is answered", async () => {
      const responding = await make();
      const { response } = await responding.begin({ participant: "leon", subject: "quiz", at });
      expect(await responding._collectedAnswers({ response })).toEqual([{ answers: [] }]);
      await responding.answer({ response, item: "q2", value: "b" });
      await responding.answer({ response, item: "q1", value: "a" });
      expect(await responding._collectedAnswers({ response })).toEqual([
        {
          answers: [
            { item: "q2", value: "b" },
            { item: "q1", value: "a" },
          ],
        },
      ]);
      expect(await responding._collectedAnswers({ response: "no-such" })).toEqual([]);
    });

    test("queries answer nothing for responses and pairings that do not exist", async () => {
      const responding = await make();
      expect(await responding._response({ response: "no-such" })).toEqual([]);
      expect(await responding._responseFor({ subject: "quiz", participant: "leon" })).toEqual([]);
      expect(await responding._answers({ response: "no-such" })).toEqual([]);
    });
  });
}

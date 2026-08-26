import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/drafting/errors.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";
import { MongoDraftingConcept } from "../../src/concepts/drafting/drafting.mongo.ts";

const floors: [string, () => Promise<MongoDraftingConcept>][] = [
  ["on MongoDB", async () => new MongoDraftingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusal = caughtError;

const material = [
  {
    prompt: "How often should a spider plant be watered?",
    choices: ["daily", "weekly"],
    expected: "weekly",
    explanation: "Its roots store water.",
  },
  { prompt: "Say one thing you noticed.", choices: [], expected: "", explanation: "" },
];

for (const [floor, make] of floors) {
  describe(`Drafting ${floor}`, () => {
    const at = new Date("2026-03-03T09:00:00Z");
    const later = new Date("2026-03-03T10:00:00Z");

    test("describe records the author, request, and creation time", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({
        author: "lee",
        request: "A five-question beginner quiz on houseplants.",
        at,
      });
      expect(await drafting._brief({ brief })).toEqual([
        {
          author: "lee",
          request: "A five-question beginner quiz on houseplants.",
          createdAt: at,
          basis: null,
        },
      ]);
      expect(await drafting._standing({ brief })).toEqual([{ clarifying: false, stalled: false }]);
      expect(await drafting._brief({ brief: "no-such" })).toEqual([]);
      expect(await drafting._standing({ brief: "no-such" })).toEqual([]);
    });

    test("propose returns the material it was given, in entry order", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const { candidate } = await drafting.propose({ brief, form: "quiz", material });
      expect(await drafting._material({ candidate })).toEqual([{ form: "quiz", material }]);
      const items = await drafting._items({ candidate });
      expect(items.map((item) => item.prompt)).toEqual(material.map((entry) => entry.prompt));
      expect(new Set(items.map((item) => item.item)).size).toBe(2);
      expect(await drafting._candidateOf({ brief })).toEqual([
        { candidate, form: "quiz", adopted: false },
      ]);
      expect(await drafting._candidate({ candidate })).toEqual([
        { brief, form: "quiz", adopted: false },
      ]);
      expect(await drafting._material({ candidate: "no-such" })).toEqual([]);
    });

    test("propose fills in a missing expected or explanation as none", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A survey.", at });
      const { candidate } = await drafting.propose({
        brief,
        form: "survey",
        material: [{ prompt: "What did you notice?" }],
      });
      expect(await drafting._material({ candidate })).toEqual([
        {
          form: "survey",
          material: [
            { prompt: "What did you notice?", choices: [], expected: "", explanation: "" },
          ],
        },
      ]);
    });

    test("open begins a line from material in hand, remembering its origin", async () => {
      const drafting = await make();
      const { brief, candidate } = await drafting.open({
        author: "lee",
        request: "Houseplants, as it stands",
        form: "quiz",
        material,
        origin: "questionnaire-1",
        at,
      });
      expect(await drafting._material({ candidate })).toEqual([{ form: "quiz", material }]);
      expect(await drafting._candidateOf({ brief })).toEqual([
        { candidate, form: "quiz", adopted: false },
      ]);
      expect(await drafting._originOf({ brief })).toEqual([{ origin: "questionnaire-1" }]);
      expect(await drafting._standing({ brief })).toEqual([{ clarifying: false, stalled: false }]);
    });

    test("a correction inherits the origin of the line it continues", async () => {
      const drafting = await make();
      const { candidate } = await drafting.open({
        author: "lee",
        request: "Houseplants, as it stands",
        form: "quiz",
        material,
        origin: "questionnaire-1",
        at,
      });
      const { brief: correction } = await drafting.correct({
        author: "lee",
        candidate,
        request: "Sharpen the first question.",
        at: later,
      });
      expect(await drafting._originOf({ brief: correction })).toEqual([
        { origin: "questionnaire-1" },
      ]);
      const { candidate: revised } = await drafting.propose({
        brief: correction,
        form: "quiz",
        material,
      });
      const { brief: further } = await drafting.correct({
        author: "lee",
        candidate: revised,
        request: "Once more.",
        at: later,
      });
      expect(await drafting._originOf({ brief: further })).toEqual([{ origin: "questionnaire-1" }]);
    });

    test("the root of a corrected line answers the first request", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz on tides.", at });
      expect(await drafting._rootOf({ brief })).toEqual([
        { root: brief, request: "A quiz on tides." },
      ]);
      const { candidate } = await drafting.propose({ brief, form: "quiz", material });
      const { brief: correction } = await drafting.correct({
        author: "lee",
        candidate,
        request: "Sharpen the wording.",
        at: later,
      });
      const { candidate: revised } = await drafting.propose({
        brief: correction,
        form: "quiz",
        material,
      });
      const { brief: further } = await drafting.correct({
        author: "lee",
        candidate: revised,
        request: "Once more.",
        at: later,
      });
      expect(await drafting._rootOf({ brief: further })).toEqual([
        { root: brief, request: "A quiz on tides." },
      ]);
      expect(await drafting._rootOf({ brief: "no-such" })).toEqual([]);
    });

    test("a described line has no origin", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      expect(await drafting._originOf({ brief })).toEqual([]);
      expect(await drafting._originOf({ brief: "no-such" })).toEqual([]);
    });

    test("a drafted brief refuses a second proposal and a further question", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      await drafting.propose({ brief, form: "quiz", material });
      expect(
        await refusal(() => drafting.propose({ brief, form: "quiz", material })),
      ).toBeInstanceOf(refusalErrors.AlreadyDrafted);
      expect(
        await refusal(() => drafting.ask({ brief, question: "Quiz or survey?" })),
      ).toBeInstanceOf(refusalErrors.AlreadyDrafted);
      expect(await refusal(() => drafting.stall({ brief, reason: "no model" }))).toBeInstanceOf(
        refusalErrors.NotAwaitingDraft,
      );
      expect(
        await refusal(() => drafting.propose({ brief: "no-such", form: "quiz", material })),
      ).toBeInstanceOf(refusalErrors.BriefNotFound);
      expect(
        await refusal(() => drafting.ask({ brief: "no-such", question: "Which?" })),
      ).toBeInstanceOf(refusalErrors.BriefNotFound);
      expect(
        await refusal(() => drafting.stall({ brief: "no-such", reason: "gone" })),
      ).toBeInstanceOf(refusalErrors.BriefNotFound);
    });

    test("asking holds the draft until the author clarifies", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({
        author: "lee",
        request: "Something about houseplants.",
        at,
      });
      const { clarification } = await drafting.ask({
        brief,
        question: "Do you mean a quiz or a survey?",
      });
      expect(await drafting._standing({ brief })).toEqual([{ clarifying: true, stalled: false }]);
      expect(await drafting._clarifications({ brief })).toEqual([
        { clarification, question: "Do you mean a quiz or a survey?", answer: null },
      ]);
      expect(
        await refusal(() => drafting.propose({ brief, form: "quiz", material })),
      ).toBeInstanceOf(refusalErrors.AwaitingClarification);
      expect(await drafting.clarify({ clarification, answer: "A quiz." })).toEqual({
        clarification,
        brief,
      });
      expect(await drafting._standing({ brief })).toEqual([{ clarifying: false, stalled: false }]);
      expect(await drafting._clarifications({ brief })).toEqual([
        { clarification, question: "Do you mean a quiz or a survey?", answer: "A quiz." },
      ]);
      const { candidate } = await drafting.propose({ brief, form: "quiz", material });
      expect(await drafting._candidateOf({ brief })).toEqual([
        { candidate, form: "quiz", adopted: false },
      ]);
      expect(
        await refusal(() => drafting.clarify({ clarification, answer: "Again." })),
      ).toBeInstanceOf(refusalErrors.AlreadyAnswered);
      expect(
        await refusal(() => drafting.clarify({ clarification: "no-such", answer: "x" })),
      ).toBeInstanceOf(refusalErrors.ClarificationNotFound);
    });

    test("a stalled request takes no draft and no question", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      expect(await drafting.stall({ brief, reason: "nothing came back" })).toEqual({ brief });
      expect(await drafting._standing({ brief })).toEqual([{ clarifying: false, stalled: true }]);
      expect(
        await refusal(() => drafting.propose({ brief, form: "quiz", material })),
      ).toBeInstanceOf(refusalErrors.RequestStalled);
      expect(await refusal(() => drafting.ask({ brief, question: "Which?" }))).toBeInstanceOf(
        refusalErrors.RequestStalled,
      );
      expect(await refusal(() => drafting.stall({ brief, reason: "again" }))).toBeInstanceOf(
        refusalErrors.NotAwaitingDraft,
      );
    });

    test("corrections chain into a line read from the first brief", async () => {
      const drafting = await make();
      const first = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const firstDraft = await drafting.propose({ brief: first.brief, form: "quiz", material });
      const second = await drafting.correct({
        author: "lee",
        candidate: firstDraft.candidate,
        request: "Replace the watering question with one on soil moisture.",
        at: later,
      });
      const secondDraft = await drafting.propose({
        brief: second.brief,
        form: "quiz",
        material: [{ prompt: "How do you check soil moisture?", choices: ["finger", "guess"] }],
      });
      expect(await drafting._brief({ brief: second.brief })).toEqual([
        {
          author: "lee",
          request: "Replace the watering question with one on soil moisture.",
          createdAt: later,
          basis: firstDraft.candidate,
        },
      ]);
      expect(await drafting._line({ brief: first.brief })).toEqual([
        {
          brief: first.brief,
          request: "A quiz.",
          basis: null,
          candidate: firstDraft.candidate,
          form: "quiz",
          adopted: false,
        },
        {
          brief: second.brief,
          request: "Replace the watering question with one on soil moisture.",
          basis: firstDraft.candidate,
          candidate: secondDraft.candidate,
          form: "quiz",
          adopted: false,
        },
      ]);
      expect(await drafting._line({ brief: second.brief })).toEqual([
        {
          brief: second.brief,
          request: "Replace the watering question with one on soil moisture.",
          basis: firstDraft.candidate,
          candidate: secondDraft.candidate,
          form: "quiz",
          adopted: false,
        },
      ]);
      expect(await drafting._line({ brief: "no-such" })).toEqual([]);
      expect((await drafting._briefs({ author: "lee" })).map((row) => row.brief)).toEqual([
        second.brief,
        first.brief,
      ]);
      expect(await drafting._briefs({ author: "nobody" })).toEqual([]);
    });

    test("a line branches when one candidate is corrected twice", async () => {
      const drafting = await make();
      const first = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const draft = await drafting.propose({ brief: first.brief, form: "quiz", material });
      const shorter = await drafting.correct({
        author: "lee",
        candidate: draft.candidate,
        request: "Make it shorter.",
        at: later,
      });
      const longer = await drafting.correct({
        author: "lee",
        candidate: draft.candidate,
        request: "Make it longer.",
        at: new Date("2026-03-03T11:00:00Z"),
      });
      expect((await drafting._line({ brief: first.brief })).map((row) => row.brief)).toEqual([
        first.brief,
        shorter.brief,
        longer.brief,
      ]);
      expect((await drafting._line({ brief: first.brief })).map((row) => row.candidate)).toEqual([
        draft.candidate,
        null,
        null,
      ]);
    });

    test("a line reads as one row, newest first, saying where it now stands", async () => {
      const drafting = await make();
      const fresh = await drafting.describe({ author: "lee", request: "A quiz on tides.", at });
      expect(await drafting._lines({ author: "lee" })).toEqual([
        {
          brief: fresh.brief,
          request: "A quiz on tides.",
          createdAt: at,
          origin: null,
          adopted: false,
          stalled: false,
          clarifying: false,
        },
      ]);

      const held = await drafting.describe({
        author: "lee",
        request: "Something about gardening.",
        at: later,
      });
      await drafting.ask({ brief: held.brief, question: "A quiz or a survey?" });
      const spent = await drafting.describe({
        author: "lee",
        request: "A quiz nothing answered.",
        at: new Date("2026-03-03T11:00:00Z"),
      });
      await drafting.stall({ brief: spent.brief, reason: "nothing came back" });

      const lines = await drafting._lines({ author: "lee" });
      expect(lines.map((row) => row.brief)).toEqual([spent.brief, held.brief, fresh.brief]);
      expect(lines[0]).toMatchObject({ stalled: true, clarifying: false, adopted: false });
      expect(lines[1]).toMatchObject({ stalled: false, clarifying: true, adopted: false });
      expect(await drafting._lines({ author: "nobody" })).toEqual([]);
    });

    test("a line answers for its tip, and a correction never begins one", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const { candidate } = await drafting.propose({ brief, form: "quiz", material });
      const { brief: correction } = await drafting.correct({
        author: "lee",
        candidate,
        request: "Sharpen the wording.",
        at: later,
      });
      expect((await drafting._lines({ author: "lee" })).map((row) => row.brief)).toEqual([brief]);

      await drafting.stall({ brief: correction, reason: "nothing came back" });
      expect(await drafting._lines({ author: "lee" })).toMatchObject([
        { brief, stalled: true, clarifying: false, adopted: false },
      ]);

      await drafting.adopt({ candidate });
      expect(await drafting._lines({ author: "lee" })).toMatchObject([
        { brief, adopted: true, stalled: true },
      ]);
    });

    test("the lines opened from an origin answer their author, newest first", async () => {
      const drafting = await make();
      const described = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const first = await drafting.open({
        author: "lee",
        request: "Houseplants, as it stands",
        form: "quiz",
        material,
        origin: "questionnaire-1",
        at,
      });
      const other = await drafting.open({
        author: "kim",
        request: "Tides, as it stands",
        form: "quiz",
        material,
        origin: "questionnaire-2",
        at: later,
      });
      const second = await drafting.open({
        author: "kim",
        request: "Houseplants again",
        form: "quiz",
        material,
        origin: "questionnaire-1",
        at: later,
      });
      await drafting.adopt({ candidate: second.candidate });

      expect(await drafting._openedFrom({ origin: "questionnaire-1" })).toEqual([
        {
          brief: second.brief,
          author: "kim",
          request: "Houseplants again",
          createdAt: later,
          adopted: true,
          stalled: false,
          clarifying: false,
        },
        {
          brief: first.brief,
          author: "lee",
          request: "Houseplants, as it stands",
          createdAt: at,
          adopted: false,
          stalled: false,
          clarifying: false,
        },
      ]);
      expect(
        (await drafting._openedFrom({ origin: "questionnaire-2" })).map((row) => row.brief),
      ).toEqual([other.brief]);
      expect(await drafting._openedFrom({ origin: "no-such" })).toEqual([]);
      expect(
        (await drafting._lines({ author: "lee" })).map((row) => [row.brief, row.origin]),
      ).toEqual([
        [first.brief, "questionnaire-1"],
        [described.brief, null],
      ]);
    });

    test("adopting closes the line to further correction", async () => {
      const drafting = await make();
      const { brief } = await drafting.describe({ author: "lee", request: "A quiz.", at });
      const { candidate } = await drafting.propose({ brief, form: "quiz", material });
      expect(await drafting.adopt({ candidate })).toEqual({ candidate });
      expect(await drafting._candidate({ candidate })).toEqual([
        { brief, form: "quiz", adopted: true },
      ]);
      expect((await drafting._line({ brief }))[0]?.adopted).toBe(true);
      expect(
        await refusal(() =>
          drafting.correct({ author: "lee", candidate, request: "One more change.", at: later }),
        ),
      ).toBeInstanceOf(refusalErrors.AlreadyAdopted);
      expect(await refusal(() => drafting.adopt({ candidate }))).toBeInstanceOf(
        refusalErrors.AlreadyAdopted,
      );
      expect(await refusal(() => drafting.adopt({ candidate: "no-such" }))).toBeInstanceOf(
        refusalErrors.CandidateNotFound,
      );
      expect(
        await refusal(() =>
          drafting.correct({ author: "lee", candidate: "no-such", request: "x", at: later }),
        ),
      ).toBeInstanceOf(refusalErrors.CandidateNotFound);
    });
  });
}

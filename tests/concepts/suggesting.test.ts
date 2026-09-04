import { afterAll, describe, expect, test } from "vite-plus/test";
import * as refusalErrors from "../../src/concepts/suggesting/errors.ts";
import { MongoSuggestingConcept } from "../../src/concepts/suggesting/suggesting.mongo.ts";
import { caughtError, stopTestDb, testDb } from "../../src/concepts/testing.ts";

const floors: [string, () => Promise<MongoSuggestingConcept>][] = [
  ["on MongoDB", async () => new MongoSuggestingConcept(await testDb())],
];

afterAll(stopTestDb);

const refusalOf = caughtError;
const at = new Date("2026-09-02T10:00:00.000Z");

const lines = [
  { kind: "reword", target: "p1", value: "Say it plainly." },
  { kind: "reword", target: "p2", value: "Cut the hedge." },
  { kind: "cut", target: "p3", value: "" },
  { kind: "heading", target: "", value: "What we found" },
];

for (const [floor, make] of floors) {
  describe(`Suggesting ${floor}`, () => {
    test("offer records the offering and its suggestions in the lines' order, all pending", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({ subject: "draft", lines, at });
      expect(await suggesting._offering({ offering })).toEqual([
        { subject: "draft", offeredAt: at },
      ]);
      expect(await suggesting._offering({ offering: "ghost" })).toEqual([]);
      const suggestions = await suggesting._suggestions({ offering });
      expect(suggestions).toEqual(
        lines.map((line, index) => ({
          suggestion: expect.any(String),
          kind: line.kind,
          target: line.target,
          value: line.value,
          position: index + 1,
          standing: "pending",
        })),
      );
      expect(new Set(suggestions.map((row) => row.suggestion)).size).toBe(4);
    });

    test("offer treats an absent target or value as empty", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({
        subject: "draft",
        lines: [{ kind: "cut" }],
        at,
      });
      expect(await suggesting._suggestions({ offering })).toEqual([
        {
          suggestion: expect.any(String),
          kind: "cut",
          target: "",
          value: "",
          position: 1,
          standing: "pending",
        },
      ]);
    });

    test("offer refuses an empty seq", async () => {
      const suggesting = await make();
      expect(
        await refusalOf(() => suggesting.offer({ subject: "draft", lines: [], at })),
      ).toBeInstanceOf(refusalErrors.NothingOffered);
      expect(await suggesting._offeringsAbout({ subject: "draft" })).toEqual([]);
    });

    test("offer refuses an entry with no kind and records nothing", async () => {
      const suggesting = await make();
      for (const line of [{ target: "p1" }, { kind: "  " }, { kind: 7 }, "not an entry", null]) {
        expect(
          await refusalOf(() =>
            suggesting.offer({
              subject: "draft",
              lines: [{ kind: "reword", target: "p1", value: "x" }, line as never],
              at,
            }),
          ),
        ).toBeInstanceOf(refusalErrors.InvalidSuggestion);
      }
      expect(await suggesting._offeringsAbout({ subject: "draft" })).toEqual([]);
    });

    test("offer refuses an entry whose target or value is not a String", async () => {
      const suggesting = await make();
      expect(
        await refusalOf(() =>
          suggesting.offer({ subject: "draft", lines: [{ kind: "cut", target: 3 }], at }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidSuggestion);
      expect(
        await refusalOf(() =>
          suggesting.offer({ subject: "draft", lines: [{ kind: "cut", value: [] }], at }),
        ),
      ).toBeInstanceOf(refusalErrors.InvalidSuggestion);
      expect(await suggesting._offeringsAbout({ subject: "draft" })).toEqual([]);
    });

    test("take settles one suggestion on its own and answers what it says", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({ subject: "draft", lines, at });
      const [first, , cut, heading] = await suggesting._suggestions({ offering });
      expect(await suggesting.take({ suggestion: first.suggestion })).toEqual({
        suggestion: first.suggestion,
        offering,
        kind: "reword",
        target: "p1",
        value: "Say it plainly.",
      });
      await suggesting.take({ suggestion: heading.suggestion });
      await suggesting.decline({ suggestion: cut.suggestion });
      expect((await suggesting._suggestions({ offering })).map((row) => row.standing)).toEqual([
        "taken",
        "pending",
        "declined",
        "taken",
      ]);
    });

    test("decline keeps the suggestion on record as declined", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({ subject: "draft", lines, at });
      const [, , cut] = await suggesting._suggestions({ offering });
      expect(await suggesting.decline({ suggestion: cut.suggestion })).toEqual({
        suggestion: cut.suggestion,
      });
      expect(await suggesting._suggestion({ suggestion: cut.suggestion })).toEqual([
        {
          offering,
          subject: "draft",
          kind: "cut",
          target: "p3",
          value: "",
          position: 3,
          standing: "declined",
        },
      ]);
    });

    test("take and decline refuse a suggestion that does not exist", async () => {
      const suggesting = await make();
      expect(await refusalOf(() => suggesting.take({ suggestion: "ghost" }))).toBeInstanceOf(
        refusalErrors.SuggestionNotFound,
      );
      expect(await refusalOf(() => suggesting.decline({ suggestion: "ghost" }))).toBeInstanceOf(
        refusalErrors.SuggestionNotFound,
      );
    });

    test("a suggestion is answered once, whichever way it was settled", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({ subject: "draft", lines, at });
      const [taken, , declined] = await suggesting._suggestions({ offering });
      await suggesting.take({ suggestion: taken.suggestion });
      await suggesting.decline({ suggestion: declined.suggestion });
      for (const suggestion of [taken.suggestion, declined.suggestion]) {
        expect(await refusalOf(() => suggesting.take({ suggestion }))).toBeInstanceOf(
          refusalErrors.SuggestionSettled,
        );
        expect(await refusalOf(() => suggesting.decline({ suggestion }))).toBeInstanceOf(
          refusalErrors.SuggestionSettled,
        );
      }
      expect((await suggesting._suggestions({ offering })).map((row) => row.standing)).toEqual([
        "taken",
        "pending",
        "declined",
        "pending",
      ]);
    });

    test("_pendingIn answers only what is still pending, in position order", async () => {
      const suggesting = await make();
      const { offering } = await suggesting.offer({ subject: "draft", lines, at });
      const [first, second, cut] = await suggesting._suggestions({ offering });
      await suggesting.take({ suggestion: first.suggestion });
      await suggesting.decline({ suggestion: cut.suggestion });
      expect(await suggesting._pendingIn({ offering })).toEqual([
        {
          suggestion: second.suggestion,
          kind: "reword",
          target: "p2",
          value: "Cut the hedge.",
          position: 2,
        },
        {
          suggestion: expect.any(String),
          kind: "heading",
          target: "",
          value: "What we found",
          position: 4,
        },
      ]);
      expect(await suggesting._pendingIn({ offering: "ghost" })).toEqual([]);
    });

    test("_offeringsAbout answers the subject's offerings, newest first", async () => {
      const suggesting = await make();
      const early = new Date("2026-09-01T10:00:00.000Z");
      const { offering: first } = await suggesting.offer({
        subject: "draft",
        lines: [{ kind: "cut" }],
        at: early,
      });
      const { offering: second } = await suggesting.offer({
        subject: "draft",
        lines: [{ kind: "cut" }],
        at,
      });
      const { offering: third } = await suggesting.offer({
        subject: "draft",
        lines: [{ kind: "cut" }],
        at,
      });
      await suggesting.offer({ subject: "other", lines: [{ kind: "cut" }], at });
      expect(await suggesting._offeringsAbout({ subject: "draft" })).toEqual([
        { offering: third, offeredAt: at },
        { offering: second, offeredAt: at },
        { offering: first, offeredAt: early },
      ]);
      expect(await suggesting._offeringsAbout({ subject: "nobody" })).toEqual([]);
    });

    test("_suggestions and _suggestion answer nothing for what does not exist", async () => {
      const suggesting = await make();
      expect(await suggesting._suggestions({ offering: "ghost" })).toEqual([]);
      expect(await suggesting._suggestion({ suggestion: "ghost" })).toEqual([]);
    });

    test("a second offering about the same subject stands on its own", async () => {
      const suggesting = await make();
      const { offering: mine } = await suggesting.offer({ subject: "draft", lines, at });
      const { offering: yours } = await suggesting.offer({
        subject: "draft",
        lines: [{ kind: "cut", target: "p9", value: "" }],
        at,
      });
      const [only] = await suggesting._suggestions({ offering: yours });
      expect(only.position).toBe(1);
      await suggesting.take({ suggestion: only.suggestion });
      expect(await suggesting._pendingIn({ offering: mine })).toHaveLength(4);
      expect(await suggesting._pendingIn({ offering: yours })).toEqual([]);
    });
  });
}

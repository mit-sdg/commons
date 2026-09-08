import { describe, expect, test } from "bun:test";
import type { RelayRound } from "@/components/live/rounds";
import {
  readMark,
  type SampleAnswer,
  type SampleRead,
  sampledPiles,
  sampleKey,
  sampleReadKeys,
  sampleSources,
  sampleWall,
  settled,
  stale,
  unanswered,
} from "./sample";

const round: RelayRound = {
  leg: "one",
  number: 1,
  title: "Three verbs",
  prompt: "Three verbs a bookmark needs.",
  question: "one-question",
  questionnaire: "one-questionnaire",
  kind: "",
  parts: [],
  cap: 0,
  choices: [],
  takes: [],
  piles: [],
  notes: "",
  hostGuide: { purpose: "", facilitation: "", selection: null },
  storedSelection: "",
};

const answer = (value: string, pile: string): SampleAnswer => ({ value, pile });

/** A dozen answers would be the real thing; five say the same about the shape. */
const answers = [
  answer("keep", "Verbs"),
  answer("find", "Verbs"),
  answer("a place to put it", "Phrases"),
  answer("share", "Verbs"),
  answer("the thing you come back to", "Phrases"),
];

const read = (
  sample: {
    answeredAt: string;
    standing: string;
    answers: SampleAnswer[];
  } | null,
  rest: {
    pending?: boolean;
    failure?: string | null;
    failedAt?: string | null;
  } = {},
): SampleRead =>
  ({
    pending: rest.pending ?? false,
    failure: rest.failure ?? null,
    failedAt: rest.failedAt ?? null,
    sample: sample === null ? null : { asking: "ask", ...sample },
  }) as SampleRead;

const sampled = (answeredAt: string, standing = "fresh") =>
  read({ answeredAt, standing, answers });

describe("the piles a sample names", () => {
  test("names each once, in the order they are first placed in", () => {
    expect(sampledPiles(answers)).toEqual(["Verbs", "Phrases"]);
  });

  test("names nothing when nothing was sampled", () => {
    expect(sampledPiles([])).toEqual([]);
  });
});

describe("the sample as a wall", () => {
  const wall = sampleWall(round, answers);

  test("holds one card per answer, in the order they were written", () => {
    expect(wall.cards.map((card) => card.value)).toEqual([
      "keep",
      "find",
      "a place to put it",
      "share",
      "the thing you come back to",
    ]);
    expect(wall.cards.map((card) => card.card)).toEqual([
      "sample-1",
      "sample-2",
      "sample-3",
      "sample-4",
      "sample-5",
    ]);
  });

  test("holds one pile per name, counted, with its cards on it", () => {
    expect(wall.piles.map((pile) => [pile.name, pile.count])).toEqual([
      ["Verbs", 3],
      ["Phrases", 2],
    ]);
    const [verbs, phrases] = wall.piles;
    expect(wall.cards.filter((card) => card.pile === verbs?.pile)).toHaveLength(
      3,
    );
    expect(
      wall.cards.filter((card) => card.pile === phrases?.pile),
    ).toHaveLength(2);
  });

  test("stands closed, as the wall a phone meets after hand-in", () => {
    expect(wall.open).toBe(false);
    expect(wall.handedIn).toBe(answers.length);
    expect(wall.number).toBe(1);
    expect(wall.questions).toEqual([]);
  });
});

describe("what the round was asked about", () => {
  test("moves when the prompt, the piles, or the note moves", () => {
    const key = sampleKey(round);
    expect(sampleKey({ ...round, prompt: "Two verbs." })).not.toBe(key);
    expect(sampleKey({ ...round, notes: "Sort by tense." })).not.toBe(key);
    expect(
      sampleKey({
        ...round,
        piles: [{ pile: "p1", name: "Verbs", description: "" }],
      }),
    ).not.toBe(key);
    expect(sampleKey({ ...round, title: "Другое" })).toBe(key);
    expect(sampleKey(null)).toBe("");
  });

  test("moves when the word pressed on the round is all that moves", () => {
    expect(sampleKey({ ...round, kind: "vote" })).not.toBe(sampleKey(round));
  });
});

describe("the accent a sample wears", () => {
  test("dims once the round has moved out from under it", () => {
    expect(stale(sampled("2026-09-05T10:00:00.000Z").sample)).toBe(false);
    expect(stale(sampled("2026-09-05T10:00:00.000Z", "stale").sample)).toBe(
      true,
    );
    expect(stale(null)).toBe(false);
  });
});

describe("whether the model answered", () => {
  test("says nothing when no failure stands", () => {
    expect(unanswered(null)).toBe(false);
    expect(unanswered(sampled("2026-09-05T10:00:00.000Z"))).toBe(false);
  });

  test("speaks for a failure newer than the sample, or with no sample at all", () => {
    expect(
      unanswered(
        read(null, {
          failure: "no reasoner",
          failedAt: "2026-09-05T10:00:00.000Z",
        }),
      ),
    ).toBe(true);
    expect(
      unanswered(
        read(
          {
            answeredAt: "2026-09-05T10:00:00.000Z",
            standing: "fresh",
            answers,
          },
          { failure: "timed out", failedAt: "2026-09-05T10:05:00.000Z" },
        ),
      ),
    ).toBe(true);
    expect(
      unanswered(
        read(
          {
            answeredAt: "2026-09-05T10:05:00.000Z",
            standing: "fresh",
            answers,
          },
          { failure: "timed out", failedAt: "2026-09-05T10:00:00.000Z" },
        ),
      ),
    ).toBe(false);
  });
});

describe("the read an ask waits on", () => {
  const before = sampled("2026-09-05T10:00:00.000Z");
  const mark = readMark(before);

  test("waits while the ask is still out", () => {
    expect(settled(read(before.sample, { pending: true }), mark)).toBe(false);
  });

  test("waits on a read taken before the ask registered", () => {
    expect(settled(before, mark)).toBe(false);
    expect(settled(null, mark)).toBe(false);
  });

  test("lands on a newer reply, and on a failure since", () => {
    expect(settled(sampled("2026-09-05T10:06:00.000Z"), mark)).toBe(true);
    expect(
      settled(
        read(before.sample, {
          failure: "timed out",
          failedAt: "2026-09-05T10:06:00.000Z",
        }),
        mark,
      ),
    ).toBe(true);
  });
});

test("preview sources traverse a long chain once, oldest first", () => {
  const second = {
    ...round,
    leg: "two",
    takes: [{ source: "one", sourceNumber: 1, use: "context" }],
  };
  const third = {
    ...round,
    leg: "three",
    takes: [{ source: "two", sourceNumber: 2, use: "choices" }],
  };
  const fourth = {
    ...round,
    leg: "four",
    takes: [{ source: "three", sourceNumber: 3, use: "parts" }],
  };
  expect(sampleSources(fourth, [round, second, third, fourth])).toEqual([
    "one",
    "two",
    "three",
  ]);
  expect(sampleSources(round, [round])).toEqual([]);
  const cyclic = {
    ...round,
    takes: [{ source: "three", sourceNumber: 3, use: "context" }],
  };
  expect(sampleSources(third, [cyclic, second, third])).toEqual(["one", "two"]);
});

test("read keys preserve fresh source inputs when only the current round changes", () => {
  const dependent = {
    ...round,
    leg: "two",
    takes: [{ source: round.leg, sourceNumber: 1, use: "context" }],
  };
  const marks = new Map([[round.leg, "source-reply-1"]]);
  const before = sampleReadKeys(dependent, [round, dependent], {}, marks);
  const edited = { ...dependent, prompt: "A new follow-up question?" };
  const after = sampleReadKeys(edited, [round, edited], {}, marks);
  expect(after.source).toBe(before.source);
  expect(after.result).not.toBe(before.result);
  expect(after.configuration).not.toBe(before.configuration);
});

test("ancestor replies invalidate input and result keys without canceling the generation configuration", () => {
  const dependent = {
    ...round,
    leg: "two",
    takes: [{ source: round.leg, sourceNumber: 1, use: "context" }],
  };
  const before = sampleReadKeys(
    dependent,
    [round, dependent],
    {},
    new Map([[round.leg, "first"]]),
  );
  const after = sampleReadKeys(
    dependent,
    [round, dependent],
    {},
    new Map([[round.leg, "second"]]),
  );
  expect(after.source).not.toBe(before.source);
  expect(after.result).not.toBe(before.result);
  expect(after.configuration).toBe(before.configuration);
});

test("unrelated rounds and assumptions do not invalidate a sample", () => {
  const unrelated = { ...round, leg: "unrelated", prompt: "Unrelated?" };
  const before = sampleReadKeys(round, [round, unrelated], {}, new Map());
  const after = sampleReadKeys(
    round,
    [round, { ...unrelated, prompt: "Changed?" }],
    { unrelated: ["A"] },
    new Map([["unrelated", "new reply"]]),
  );
  expect(after).toEqual(before);
});

test("different ask identities distinguish replies with equal timestamps", () => {
  const first = sampled("2026-09-05T10:00:00.000Z");
  const next = {
    ...first,
    sample: { ...first.sample!, asking: "another asking" },
  };
  expect(readMark(first)).not.toBe(readMark(next));
  expect(settled(next, readMark(first))).toBe(true);
});

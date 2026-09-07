import { describe, expect, test } from "bun:test";
import {
  bareVote,
  carriedGroups,
  previewQuestion,
  previewWall,
  shownRound,
  showsNames,
  showsWall,
  sourceOf,
  UNNAMED_PILES,
} from "./round-preview";
import type { RelayRound } from "./rounds";
import type { SampleAnswer } from "./sample";

const round = (
  number: number,
  leg: string,
  title: string,
  prompt: string,
  rest: Partial<RelayRound> = {},
): RelayRound => ({
  leg,
  number,
  title,
  prompt,
  question: `${leg}-question`,
  questionnaire: `${leg}-questionnaire`,
  kind: "",
  parts: [],
  cap: 0,
  choices: [],
  takes: [],
  piles: [],
  notes: "",
  hostGuide: { purpose: "", facilitation: "", selection: null },
  storedSelection: "",
  ...rest,
});

const takes = (source: RelayRound, use: string) => ({
  takes: [{ source: source.leg, sourceNumber: source.number, use }],
});

/** A write round: what it leaves behind is sorted in class, so nothing is known. */
const write = round(1, "one", "Three verbs", "Three verbs a bookmark needs.");

/** A vote round: its choices are written, so a later round can name them. */
const vote = round(2, "two", "Which pace", "Which pace fits?", {
  choices: ["Warm", "Cool"],
});

/** A list round: its parts are written too. */
const list = round(3, "three", "Two parts", "Name the pair.", {
  parts: ["a noun", "a verb"],
  cap: 0,
});

describe("what a round carries in", () => {
  test("names a vote's choices, which stand on its wall as its piles", () => {
    expect(carriedGroups(vote)).toEqual(["Warm", "Cool"]);
  });

  test("stands unnamed where the piles are only sorted in class", () => {
    expect(carriedGroups(write)).toEqual(UNNAMED_PILES);
    expect(carriedGroups(list)).toEqual(UNNAMED_PILES);
    expect(carriedGroups(null)).toEqual(UNNAMED_PILES);
  });

  test("reads the source off the leg the round takes from", () => {
    const rounds = [write, vote];
    const taker = round(3, "x", "Sort", "Sort them.", takes(write, "context"));
    expect(sourceOf(taker, [...rounds, taker])?.leg).toBe("one");
    expect(sourceOf(write, rounds)).toBeNull();
  });
});

describe("the question a phone would meet", () => {
  test("shows a round's own material when it takes nothing", () => {
    const question = previewQuestion(list, [list]);
    expect(question.parts).toEqual(["a noun", "a verb"]);
    expect(question.choices).toEqual([]);
    expect(question.context).toEqual([]);
  });

  test("takes choices from the vote it names, and unnamed piles otherwise", () => {
    const named = round(4, "a", "Pick", "Pick one.", takes(vote, "choices"));
    const unnamed = round(4, "b", "Pick", "Pick one.", takes(write, "choices"));
    expect(previewQuestion(named, [vote, named]).choices).toEqual([
      "Warm",
      "Cool",
    ]);
    expect(previewQuestion(unnamed, [write, unnamed]).choices).toEqual(
      UNNAMED_PILES,
    );
  });

  test("takes its boxes from the vote it names, and unnamed piles otherwise", () => {
    const named = round(4, "a", "Say", "Say one of each.", {
      cap: 5,
      ...takes(vote, "parts"),
    });
    const unnamed = round(4, "b", "Say", "Say one of each.", {
      cap: 5,
      ...takes(list, "parts"),
    });
    const question = previewQuestion(named, [vote, named]);
    expect(question.parts).toEqual(["Warm", "Cool"]);
    expect(question.choices).toEqual([]);
    expect(question.cap).toBe(0);
    expect(previewQuestion(unnamed, [list, unnamed]).parts).toEqual(
      UNNAMED_PILES,
    );
  });

  test("shows what it takes as context with no cards under it", () => {
    const named = round(
      4,
      "a",
      "Write",
      "Write one more.",
      takes(vote, "context"),
    );
    const unnamed = round(4, "b", "Write", "Write one more.", {
      ...takes(list, "context"),
    });
    expect(previewQuestion(named, [vote, named]).context).toEqual([
      { name: "Warm", cards: [] },
      { name: "Cool", cards: [] },
    ]);
    expect(previewQuestion(unnamed, [list, unnamed]).context).toEqual(
      UNNAMED_PILES.map((name) => ({ name, cards: [] })),
    );
  });
});

/** A round written for all three kinds at once: boxes, a cap, and choices. */
const filled = round(6, "six", "Everything", "Say it.", {
  parts: ["a noun", "a verb"],
  cap: 3,
  choices: ["Warm", "Cool"],
});

describe("the kind the round opens under", () => {
  test("is one box under write", () => {
    const question = previewQuestion({ ...filled, kind: "write" }, [filled]);
    expect(question.choices).toEqual([]);
    expect(question.parts).toEqual([]);
    expect(question.cap).toBe(0);
  });

  test("is the parts and their cap under list", () => {
    const question = previewQuestion({ ...filled, kind: "list" }, [filled]);
    expect(question.parts).toEqual(["a noun", "a verb"]);
    expect(question.cap).toBe(3);
    expect(question.choices).toEqual([]);
  });

  test("is the choices under vote", () => {
    const question = previewQuestion({ ...filled, kind: "vote" }, [filled]);
    expect(question.choices).toEqual(["Warm", "Cool"]);
    expect(question.parts).toEqual([]);
    expect(question.cap).toBe(0);
  });

  test("is what the content makes it with no word", () => {
    const question = previewQuestion(filled, [filled]);
    expect(question.choices).toEqual(["Warm", "Cool"]);
    expect(question.parts).toEqual([]);
    expect(question.cap).toBe(0);
  });

  test("hands on no named groups from a source the word makes a list", () => {
    const written = { ...vote, kind: "list" };
    const taker = round(7, "seven", "Pick", "Pick one.", {
      ...takes(written, "choices"),
    });
    expect(carriedGroups(written)).toEqual(UNNAMED_PILES);
    expect(previewQuestion(taker, [written, taker]).choices).toEqual(
      UNNAMED_PILES,
    );
  });
});

describe("a vote with nothing to vote on", () => {
  test("is a round pressed to vote whose choices are still unwritten", () => {
    expect(bareVote(round(4, "a", "Pick", "Pick one.", { kind: "vote" }))).toBe(
      true,
    );
  });

  test("is not one whose choices are written, or one that takes them", () => {
    expect(bareVote(vote)).toBe(false);
    const taker = round(4, "a", "Pick", "Pick one.", {
      kind: "vote",
      ...takes(write, "choices"),
    });
    expect(bareVote(taker)).toBe(false);
  });

  test("is not a round of another kind, whatever it holds", () => {
    expect(bareVote(write)).toBe(false);
    expect(bareVote(list)).toBe(false);
    expect(bareVote(round(4, "a", "Say", "Say one.", { kind: "list" }))).toBe(
      false,
    );
  });
});

describe("the round the column shows", () => {
  const rounds = [write, vote, list];

  test("is the first round when none is selected", () => {
    expect(shownRound(rounds, null)?.leg).toBe("one");
    expect(shownRound(rounds, "gone")?.leg).toBe("one");
  });

  test("is the one selected, and nothing at all on a relay with no rounds", () => {
    expect(shownRound(rounds, "three")?.leg).toBe("three");
    expect(shownRound([], null)).toBeNull();
  });
});

/** The piles a sample of the write round placed its answers in. */
const SAMPLED = ["Verbs", "Phrases", "Whole sentences"];

describe("what a sample of the source names", () => {
  test("stands where the class's piles would, and nowhere else", () => {
    expect(carriedGroups(write, SAMPLED)).toEqual(SAMPLED);
    expect(carriedGroups(list, SAMPLED)).toEqual(SAMPLED);
    expect(carriedGroups(vote, ["Warm"])).toEqual(["Warm"]);
    expect(carriedGroups(vote, [])).toEqual([]);
    expect(carriedGroups(null, SAMPLED)).toEqual(SAMPLED);
  });

  test("is the vote's choices when it takes them", () => {
    const taker = round(4, "a", "Pick", "Pick one.", takes(write, "choices"));
    const question = previewQuestion(taker, [write, taker], SAMPLED);
    expect(question.choices).toEqual(SAMPLED);
    expect(question.parts).toEqual([]);
  });

  test("is the boxes when it takes parts", () => {
    const taker = round(4, "a", "Say", "Say one of each.", {
      cap: 5,
      ...takes(write, "parts"),
    });
    const question = previewQuestion(taker, [write, taker], SAMPLED);
    expect(question.parts).toEqual(SAMPLED);
    expect(question.cap).toBe(0);
  });

  test("is the groups above the prompt when it takes context", () => {
    const taker = round(4, "a", "Write", "Write one more.", {
      ...takes(write, "context"),
    });
    expect(previewQuestion(taker, [write, taker], SAMPLED).context).toEqual(
      SAMPLED.map((name) => ({ name, cards: [] })),
    );
  });

  test("marks only the card that is showing the sample's names", () => {
    const sampled = round(4, "a", "Pick", "Pick one.", takes(write, "choices"));
    const written = round(4, "b", "Pick", "Pick one.", takes(vote, "choices"));
    expect(showsNames(sampled, [write, sampled], SAMPLED)).toBe(true);
    expect(showsNames(sampled, [write, sampled], [])).toBe(false);
    expect(showsNames(written, [vote, written], SAMPLED)).toBe(false);
    expect(showsNames(write, [write], SAMPLED)).toBe(false);
  });
});

describe("where the round's own sample stands", () => {
  test("on the wall for every round but one that takes its choices", () => {
    const taker = round(4, "a", "Pick", "Pick one.", takes(vote, "choices"));
    const written = round(4, "b", "Write", "Write one more.", {
      ...takes(write, "context"),
    });
    expect(showsWall(write)).toBe(true);
    expect(showsWall(written)).toBe(true);
    expect(showsWall(taker)).toBe(false);
  });
});

/** A round a lecturer wrote piles for before class, one of them unused. */
const sorted = round(5, "five", "What for", "What is a bookmark for?", {
  piles: [
    { pile: "p1", name: "saving", description: "Anything kept for later." },
    { pile: "p2", name: "undo", description: "" },
  ],
});

/** A sample that filled one of those piles and opened one of its own. */
const placed: SampleAnswer[] = [
  { value: "keep it", pile: "saving" },
  { value: "bookmark it", pile: "saving" },
  { value: "put it back", pile: "retrieving" },
];

describe("the wall the preview stands under", () => {
  const wall = previewWall(sorted, placed);

  test("stands every pile of the round, empty where nothing landed", () => {
    expect(wall.piles.map((pile) => [pile.name, pile.count])).toEqual([
      ["saving", 2],
      ["undo", 0],
      ["retrieving", 1],
    ]);
  });

  test("keeps a standing pile's sentence and the cards it took", () => {
    const [saving, undo] = wall.piles;
    expect(saving?.description).toBe("Anything kept for later.");
    expect(undo?.description).toBe("");
    expect(
      wall.cards.filter((card) => card.pile === saving?.pile),
    ).toHaveLength(2);
  });
});

test("all carry modes include supporting example responses", () => {
  const groups = [
    { name: "Lost work", cards: ["The app erased my notes."] },
    { name: "Desires", cards: [] },
  ];
  for (const use of ["context", "choices", "parts"]) {
    const taker = round(
      4,
      "four",
      "Next",
      "Use the earlier responses.",
      takes(write, use),
    );
    const question = previewQuestion(
      taker,
      [write, taker],
      groups.map((group) => group.name),
      groups,
    );
    expect(question.context).toEqual(groups);
    expect(question.contextUse).toBe(use);
  }
});

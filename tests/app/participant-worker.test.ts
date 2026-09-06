import { describe, expect, test } from "vite-plus/test";
import type { RunSnapshot } from "../../src/computations/live-snapshots.ts";
import type { ParticipantFloor } from "../../src/reasoning/participant.ts";
import { serveParticipantsOnce } from "../../src/reasoning/participant.ts";

const presentation: RunSnapshot = {
  title: "What would help",
  form: "survey",
  disclosure: "score",
  questions: [
    {
      item: "q1",
      prompt: "What would help you most right now?",
      choices: [],
      expected: "",
      explanation: "",
      parts: ["First", "Second"],
      cap: 0,
      position: 1,
    },
    {
      item: "q2",
      prompt: "How is the pace?",
      choices: ["Too fast", "About right"],
      expected: "",
      explanation: "",
      position: 2,
    },
  ],
};

const said = JSON.stringify({
  kind: "answers",
  answers: [
    { item: "q1#1", value: "more worked examples" },
    { item: "q1#2", value: "slower on proofs" },
    { item: "q2", value: "About right" },
  ],
});

interface SeatResponse {
  response: string;
  participant: string;
  submitted: boolean;
  startedAt: Date;
}

interface FloorState {
  editions: string[];
  links: Record<string, string>;
  snapshots: Record<string, unknown>;
  responses: Record<string, SeatResponse[]>;
  replies: Record<string, string>;
  seats: Record<string, string[]>;
}

/** The floor as the worker reads it, with what it wrote back kept beside it. */
function floorOf(state: Partial<FloorState>) {
  const {
    editions = [],
    links = {},
    snapshots = {},
    responses = {},
    replies = {},
    seats = {},
  } = state;
  const answered: { response: string; item: string; value: string }[] = [];
  const submitted: string[] = [];
  const concepts: ParticipantFloor = {
    Publishing: {
      _openEditions: () => editions.map((edition) => ({ edition })),
    },
    Responding: {
      _responsesFor: ({ subject }) => responses[subject] ?? [],
      answer: (input) => {
        answered.push(input);
        return undefined;
      },
      submit: ({ response }) => {
        submitted.push(response);
        return undefined;
      },
    },
    Reasoning: {
      _repliesAbout: ({ about }) =>
        replies[about] === undefined ? [] : [{ reply: replies[about] }],
    },
    Linking: {
      _getLinks: ({ source }) => (links[source] === undefined ? [] : [{ target: links[source] }]),
    },
    Subscribing: {
      _isSubscribed: ({ user, target }) => ({
        subscribed: (seats[user] ?? []).includes(target),
      }),
    },
    RunSnapshotting: {
      _snapshot: ({ subject }) => (subject in snapshots ? [{ value: snapshots[subject] }] : []),
    },
  };
  return { concepts, answered, submitted };
}

const seated: SeatResponse = {
  response: "r1",
  participant: "model:d1",
  submitted: false,
  startedAt: new Date(),
};

/** Far enough ahead that every participant's own delay has passed. */
const later = () => new Date(Date.now() + 60_000);

describe("the participant worker", () => {
  test("plays an unlinked edition, finding the seat on the edition itself", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      snapshots: { "run-1": presentation },
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(1);
    expect(floor.answered).toEqual([
      { response: "r1", item: "q1#1", value: "more worked examples" },
      { response: "r1", item: "q1#2", value: "slower on proofs" },
      { response: "r1", item: "q2", value: "About right" },
    ]);
    expect(floor.submitted).toEqual(["r1"]);
  });

  test("leaves a response whose participant holds no seat", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      snapshots: { "run-1": presentation },
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: {},
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(0);
    expect(floor.answered).toEqual([]);
    expect(floor.submitted).toEqual([]);
  });

  test("plays a round, finding the seat on the run its edition is linked to", async () => {
    const floor = floorOf({
      editions: ["round-1"],
      links: { "round-1": "run-1" },
      snapshots: { "round-1": presentation },
      responses: { "round-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(1);
    expect(floor.answered).toHaveLength(3);
    expect(floor.submitted).toEqual(["r1"]);
  });

  test("passes over an edition whose run was captured in no snapshot", async () => {
    const floor = floorOf({
      editions: ["run-1"],
      responses: { "run-1": [seated] },
      replies: { r1: said },
      seats: { "model:d1": ["run-1"] },
    });

    expect(await serveParticipantsOnce(floor.concepts, later)).toBe(0);
    expect(floor.answered).toEqual([]);
    expect(floor.submitted).toEqual([]);
  });
});

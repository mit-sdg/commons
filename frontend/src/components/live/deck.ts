/**
 * The deck: relays ready to copy. Each is content, not a feature — a title
 * and its rounds, played through the same relay endpoints a staff member
 * would use by hand. Copying one plans a fresh relay and adds its rounds.
 */

export interface DeckRound {
  title: string;
  prompt: string;
  parts: string[];
  cap: number;
  choices: string[];
  /** The round it takes from, by number, and the shape; absent when it takes nothing. */
  takes?: { from: number; shape: "picked" | "every" | "top" };
}

export interface DeckRelay {
  key: string;
  title: string;
  rounds: DeckRound[];
}

export const DECK: DeckRelay[] = [
  {
    key: "three-verbs",
    title: "Three verbs, then a stranger",
    rounds: [
      {
        title: "Three verbs",
        prompt: "Three verbs a bookmark needs.",
        parts: ["one", "two", "three"],
        cap: 0,
        choices: [],
      },
      {
        title: "The stranger",
        prompt: "Only these verbs. What is it?",
        parts: ["answer"],
        cap: 0,
        choices: [],
        takes: { from: 1, shape: "picked" },
      },
    ],
  },
  {
    key: "name-the-activity",
    title: "Name the activity",
    rounds: [
      {
        title: "One word",
        prompt:
          "DoorDash, the screen before you order. One word for what this lets you do.",
        parts: [],
        cap: 0,
        choices: [],
      },
    ],
  },
  {
    key: "break-my-rule",
    title: "Break my rule",
    rounds: [
      {
        title: "Breaks it",
        prompt:
          "A short history where something bad happens and nothing refuses.",
        parts: [],
        cap: 0,
        choices: [],
      },
    ],
  },
  {
    key: "bad-thing-board",
    title: "Bad thing board",
    rounds: [
      {
        title: "Bad things",
        prompt:
          "Something that went wrong for you this week using software. One sentence. No solutions.",
        parts: [],
        cap: 0,
        choices: [],
      },
    ],
  },
  {
    key: "fix-the-spec",
    title: "Fix the spec",
    rounds: [
      {
        title: "Rewrite",
        prompt:
          "“Manages the lifecycle of bookings, including creation, modification, and cancellation.” Rewrite it as a purpose.",
        parts: [],
        cap: 0,
        choices: [],
      },
      {
        title: "Vote",
        prompt: "Which rewrite is the purpose?",
        parts: [],
        cap: 0,
        choices: [],
        takes: { from: 1, shape: "picked" },
      },
    ],
  },
];

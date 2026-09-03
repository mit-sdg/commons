/**
 * The deterministic relay-drafting replies. They read the same passages the
 * real mind receives and key off markers the author's own brief places there,
 * so a test asks for a relay in the words a staff member would use.
 */

/** The first line of the relay-drafting contract, which no other passage carries. */
const CONTRACT = "You revise a relay for a live classroom tool";

const REPAIR = "Your previous reply came back unusable";

const relay = (rounds: unknown[]) => JSON.stringify({ kind: "relay", rounds });

const oneRound = () =>
  relay([
    {
      title: "Warm-up",
      prompt: "In one word, how is the pace so far?",
      parts: [],
      cap: 0,
      choices: [],
      takes: { from: 0, shape: "" },
    },
  ]);

const twoRounds = () =>
  relay([
    {
      title: "Three verbs",
      prompt: "Name three verbs from the passage.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
      takes: { from: 0, shape: "" },
    },
    {
      title: "The stranger",
      prompt: "Which verb best fits the stranger?",
      parts: ["answer"],
      cap: 0,
      choices: [],
      takes: { from: 1, shape: "picked" },
    },
  ]);

/** The two standing rounds delivered the other way about, keeping their numbers. */
const swapped = () =>
  relay([
    {
      number: 2,
      title: "The stranger",
      prompt: "Which verb best fits the stranger?",
      parts: ["answer"],
      cap: 0,
      choices: [],
      takes: { from: 0, shape: "" },
    },
    {
      number: 1,
      title: "Three verbs",
      prompt: "Name three verbs from the passage.",
      parts: ["one", "two", "three"],
      cap: 0,
      choices: [],
      takes: { from: 0, shape: "" },
    },
  ]);

export function scriptedEditsReply(passage: string): string | undefined {
  if (!passage.includes(CONTRACT)) return undefined;
  const written = passage.split("The brief:\n")[1] ?? "";
  const brief = written.split(`\n\n${REPAIR}`)[0].toLowerCase();
  const answer = brief.includes("swap")
    ? swapped()
    : brief.includes("three verbs")
      ? twoRounds()
      : oneRound();
  if (passage.includes(REPAIR)) return answer;
  return brief.includes("unreadable") ? "this reply is not JSON at all" : answer;
}

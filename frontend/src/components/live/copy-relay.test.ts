import { expect, test } from "bun:test";
import type { Output } from "@/lib/api";
import { roundsToCopy } from "./copy-relay";

test("copy projection preserves host guidance, including inactive selection text", () => {
  const relay: NonNullable<Output<"/live/relays/get">["relay"]> = {
    relay: "relay",
    title: "Workshop",
    description: "Build together.",
    createdAt: "2026-09-07T00:00:00Z",
    retired: false,
    hostGuide: { opening: "Invite an incident.", closing: "Reflect together." },
    runs: [],
    rounds: [
      {
        leg: "one",
        number: 1,
        title: "Incidents",
        prompt: "What happened?",
        question: "q",
        questionnaire: "sheet",
        kind: "write",
        parts: [],
        choices: [],
        cap: 0,
        takes: [],
        piles: [],
        notes: "",
        hostGuide: {
          purpose: "Gather concrete evidence.",
          facilitation: "Allow quiet writing.",
          selection: null,
        },
        storedSelection: "Choose two distinct incidents.",
      },
    ],
  };
  expect(roundsToCopy(relay)[0]?.hostGuide).toEqual({
    purpose: "Gather concrete evidence.",
    facilitation: "Allow quiet writing.",
    selection: "Choose two distinct incidents.",
  });
});

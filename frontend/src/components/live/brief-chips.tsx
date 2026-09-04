"use client";

import { cn } from "@/lib/utils";

/** What a relay is, wherever an author meets one before writing it. */
export const RELAY_LINES = [
  "A relay is a few rounds in a row. Each round can build on the answers before it. Ask for ideas, vote on them, then dig into the winner.",
  "The model can sit in as participants and groups the answers as they come in, so two hundred answers read as a few piles.",
] as const;

/** What the brief box takes, by what is being drafted. */
export const BRIEF_PLACEHOLDER = {
  quiz: "Describe the quiz you want, or just what you want to check the class has understood. The model writes the questions, and you can change anything after.",
  survey:
    "Describe the survey you want, or just what you want to find out from the class. The model writes the questions, and you can change anything after.",
  relay:
    "Describe the rounds you want, or just the experience you want the class to have. The model drafts the rounds, and you can change anything after.",
} as const;

/** Briefs that draft well, offered under the box in the author's own words. */
export const BRIEF_CHIPS = {
  quiz: [
    "Five questions on photosynthesis for an intro biology lecture, one right answer each",
    "Check that the class can tell a concept from a feature",
    "Ten questions on last week's reading, the hardest last",
  ],
  survey: [
    "Ask how the problem sets are going and what took the longest",
    "Find out what the class already knows about databases before I teach it",
    "Ask which project topics people want to work on",
  ],
  relay: [
    "Help the class find out what they have in common, starting from the app they'd delete first",
    "List the concepts in the app you opened last, then pick the one it can't live without",
    "Invent one app together over ten rounds: who it's for, what hurts, one concept at a time, then a name, then the pitch",
    "I want the class to argue about whether likes should exist, and end with a decision",
    "One thing to change about this class, then vote on what we fix first",
    "Suggest a time for office hours, then vote",
  ],
} as const;

export type BriefKind = keyof typeof BRIEF_CHIPS;

/** Briefs to start from: tapping one writes it into the box. */
export function BriefChips({
  chips,
  onPick,
  className,
}: {
  chips: readonly string[];
  onPick: (chip: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onPick(chip)}
          className="max-w-full rounded-full border border-border bg-background px-3 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

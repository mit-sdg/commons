"use client";

import { cn } from "@/lib/utils";

/** What a relay is, wherever an author meets one before writing it. */
export const RELAY_LINES = [
  "A relay is a few rounds in a row. Each round can build on the answers before it. Ask for ideas, vote on them, then dig into the winner.",
  "AI can generate practice responses and group incoming answers into piles.",
] as const;

/**
 * What each kind is, wherever an author meets one before writing it. A quiz and
 * a survey ask the same way and differ only in whether an answer can be right,
 * so each says that in its first breath — it is the one thing an author cannot
 * tell from the form.
 */
export const KIND_LINES = {
  quiz: ["A quiz is questions with right answers. Every hand-in is scored."],
  survey: [
    "A survey is questions with no right answers. Nothing is scored; you read what comes in.",
  ],
  relay: RELAY_LINES,
} as const;

/** The one phrase the menu gives each kind, beside its name. */
export const KIND_PHRASES = {
  quiz: "Graded",
  survey: "Not graded",
  relay: "Rounds in a row",
} as const;

/** What the brief box takes, by what is being drafted. */
export const BRIEF_PLACEHOLDER = {
  questionnaire: "Describe the topic, audience, and questions you want.",
  relay:
    "Describe what you want the class to explore and how the rounds should build on each other.",
} as const;

/** Briefs that draft well, offered under the box in the author's own words. */
export const BRIEF_CHIPS = {
  questionnaire: [
    "A five-question quiz on photosynthesis for an intro biology lecture, one right answer each",
    "A quiz to check that the class can tell a concept from a feature",
    "A survey asking how the problem sets are going and what took the longest",
    "A survey to find out what the class already knows about databases before I teach it",
  ],
  relay: [
    "Ask which app students would delete first, group their reasons, then vote on the most common reason",
    "List the concepts in an app students use, then vote on the most essential one",
    "Design an app over ten rounds, starting with its audience and problem and ending with a name and pitch",
    "Collect arguments for and against social media likes, discuss them, then vote",
    "Suggest improvements to this class, group similar ideas, then vote on what to change first",
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

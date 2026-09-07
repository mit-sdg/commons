"use client";

import { useState } from "react";
import { distinctValues } from "@/components/live/rounds";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** A round's question as a phone meets it: the prompt, and how it is answered. */
export interface RoundQuestion {
  question: string;
  prompt: string;
  choices: string[];
  parts: string[];
  cap: number;
  /** The groups a round carried from the one it takes from, shown above the prompt. */
  context?: { name: string; cards: string[] }[];
  contextUse?: string;
  position: number;
}

const COUNTING_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

/**
 * What one box of a repeated question is called. Every box carries the same
 * part, so where it sits is what tells it from the others: "a verb, two of
 * three". A lone box is told apart from nothing, so it keeps the part alone.
 */
export function boxName(part: string, index: number, of: number): string {
  if (of <= 1) return part;
  const place = `${COUNTING_WORDS[index] ?? index + 1} of ${
    COUNTING_WORDS[of - 1] ?? of
  }`;
  return part === "" ? place : `${part}, ${place}`;
}

/**
 * Every item a question is answered under: itself when it has no parts, one
 * `question#n` per labeled part, or `question#1..cap` for a repeated box.
 */
export function itemsOf(question: RoundQuestion): string[] {
  if (question.parts.length === 0) return [question.question];
  const count = question.cap >= 2 ? question.cap : question.parts.length;
  return Array.from(
    { length: count },
    (_, index) => `${question.question}#${index + 1}`,
  );
}

const filled = (answers: Record<string, string>, items: string[]): number =>
  items.filter((item) => (answers[item] ?? "").trim() !== "").length;

/** How many written answers a question holds across a round's questions. */
export function answeredOf(
  questions: RoundQuestion[],
  answers: Record<string, string>,
): number {
  return questions.reduce(
    (count, question) => count + filled(answers, itemsOf(question)),
    0,
  );
}

export function itemCountOf(questions: RoundQuestion[]): number {
  return questions.reduce(
    (count, question) => count + itemsOf(question).length,
    0,
  );
}

/**
 * A round is whole when every box it captured has an answer — a repeated box
 * asks for one of its own. The round refuses a hand-in that is not whole, and
 * decides it the same way, so the button is dead exactly where it would be
 * refused.
 */
export function wholeOf(
  questions: RoundQuestion[],
  answers: Record<string, string>,
): boolean {
  return questions.every((question) => {
    const items = itemsOf(question);
    return question.cap >= 2
      ? filled(answers, items) > 0
      : filled(answers, items) === items.length;
  });
}

export function QuestionCard({
  question,
  answers,
  onAnswer,
  onDraft,
}: {
  question: RoundQuestion;
  answers: Record<string, string>;
  onAnswer: (item: string, value: string) => void;
  onDraft: (item: string, value: string) => void;
}) {
  const items = itemsOf(question);
  const repeated = question.parts.length > 0 && question.cap >= 2;
  // A choice is one answer, so it lands on the question's first item — the
  // question itself, or the first part when the round carries parts.
  const chosen = items[0] ?? question.question;
  const [shown, setShown] = useState(() => Math.max(1, filled(answers, items)));
  const context = question.context ?? [];
  const promptId = `prompt-${question.question}`;

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      {context.length > 0 &&
      (question.contextUse ?? "context") === "context" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs">
            From an earlier round
          </span>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] items-start gap-2">
            {context.map((group, index) => (
              <SourceEvidence key={`${group.name}-${index}`} group={group} />
            ))}
          </div>
        </div>
      ) : null}

      <h2
        className="font-sans text-[15px] font-medium leading-[1.45]"
        dir="auto"
        id={promptId}
      >
        {question.prompt}
      </h2>

      {question.choices.length > 0 ? (
        <div className="flex flex-col gap-2">
          {question.choices.map((choice, index) => (
            <div
              key={`${choice}-${index}`}
              className="flex min-w-0 flex-col gap-1"
            >
              <Choice
                choice={choice}
                picked={answers[chosen] === choice}
                onPick={() => onAnswer(chosen, choice)}
              />
              {question.contextUse === "choices"
                ? context
                    .filter(
                      (group) =>
                        group.name === choice && group.cards.length > 0,
                    )
                    .map((group) => (
                      <SourceEvidence
                        key={group.name}
                        group={group}
                        supporting
                      />
                    ))
                : null}
            </div>
          ))}
        </div>
      ) : question.parts.length === 0 ? (
        <WrittenBox
          value={answers[question.question] ?? ""}
          labelledBy={promptId}
          placeholder="Your answer"
          onAnswer={(written) => onAnswer(question.question, written)}
          onDraft={(written) => onDraft(question.question, written)}
        />
      ) : repeated ? (
        <>
          <div className="flex flex-col gap-1">
            <PartLabel>{question.parts[0] ?? ""}</PartLabel>
            {items.slice(0, shown).map((item, index) => (
              <WrittenBox
                key={item}
                value={answers[item] ?? ""}
                label={boxName(question.parts[0] ?? "", index, shown)}
                onAnswer={(written) => onAnswer(item, written)}
                onDraft={(written) => onDraft(item, written)}
              />
            ))}
          </div>
          {shown < question.cap ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setShown((standing) => Math.min(question.cap, standing + 1))
                }
                className="h-11 flex-1 rounded-md border border-input border-dashed px-3 text-start text-sm text-muted-foreground"
              >
                + another
              </button>
              <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                up to {question.cap}
              </span>
            </div>
          ) : null}
        </>
      ) : (
        question.parts.map((label, index) => {
          const item = items[index] ?? "";
          return (
            <div key={item} className="flex min-w-0 flex-col gap-1">
              <PartLabel>{label}</PartLabel>
              {question.contextUse === "parts"
                ? context
                    .filter(
                      (group) => group.name === label && group.cards.length > 0,
                    )
                    .map((group) => (
                      <SourceEvidence
                        key={group.name}
                        group={group}
                        supporting
                      />
                    ))
                : null}
              <WrittenBox
                value={answers[item] ?? ""}
                label={label}
                onAnswer={(written) => onAnswer(item, written)}
                onDraft={(written) => onDraft(item, written)}
              />
            </div>
          );
        })
      )}
    </section>
  );
}

function SourceEvidence({
  group,
  supporting = false,
}: {
  group: { name: string; cards: string[] };
  supporting?: boolean;
}) {
  const values = distinctValues(group.cards);
  if (values.length === 0)
    return (
      <p
        className="min-w-0 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium [overflow-wrap:anywhere]"
        dir="auto"
      >
        {group.name}
      </p>
    );
  return (
    <details className="group min-w-0 rounded-lg border border-border bg-muted/40 px-3">
      <summary className="min-h-11 cursor-pointer py-3 text-sm [overflow-wrap:anywhere]">
        <span className="font-medium" dir="auto">
          {supporting ? "Supporting responses" : group.name}
        </span>
        <span className="ml-2 whitespace-nowrap text-muted-foreground text-xs">
          {values.length} {values.length === 1 ? "response" : "responses"}
        </span>
        <span
          className="mt-1 line-clamp-2 text-muted-foreground text-xs group-open:hidden"
          dir="auto"
        >
          {values[0]}
        </span>
      </summary>
      <ul className="flex flex-col gap-2 pb-3">
        {values.map((value, card) => (
          <li
            key={card}
            className="whitespace-pre-wrap rounded-md bg-background p-2.5 text-sm leading-relaxed [overflow-wrap:anywhere]"
            dir="auto"
          >
            {value}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * One choice of a vote. The mark is what says a row is a choice and not a box:
 * a ring that fills when this is the one picked. Colour alone carries the pick
 * to nobody, so the row is pressed as well as marked.
 */
export function Choice({
  choice,
  picked,
  onPick,
}: {
  choice: string;
  picked: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      dir="auto"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        "flex items-center gap-3 rounded-md border border-border px-4 py-3 text-start text-sm transition-colors",
        picked
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "hover:bg-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-4 flex-none items-center justify-center rounded-full border-[1.5px]",
          picked ? "border-primary" : "border-input",
        )}
      >
        {picked ? <span className="size-2 rounded-full bg-primary" /> : null}
      </span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{choice}</span>
    </button>
  );
}

function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </span>
  );
}

/** How many lines a written answer grows to before the box scrolls inside. */
const BOX_LINES = 3;

/** How tall a box stands: what is written in it, up to the cap. */
function fitBox(box: HTMLTextAreaElement) {
  const style = window.getComputedStyle(box);
  const line =
    Number.parseFloat(style.lineHeight) ||
    Number.parseFloat(style.fontSize) * 1.5;
  const inside =
    Number.parseFloat(style.paddingTop) +
    Number.parseFloat(style.paddingBottom);
  const frame =
    Number.parseFloat(style.borderTopWidth) +
    Number.parseFloat(style.borderBottomWidth);
  box.style.height = "auto";
  const grown = Math.min(box.scrollHeight, line * BOX_LINES + inside);
  box.style.height = `${grown + frame}px`;
}

/**
 * The field stays uncontrolled — typing drafts, blur commits. Every blur
 * commits: the draft it would compare against is the same state typing just
 * wrote, and the sender is what knows a value it has already sent. A line
 * break is part of a written answer, so Enter writes one.
 */
export function WrittenBox({
  value,
  label,
  labelledBy,
  placeholder,
  onAnswer,
  onDraft,
}: {
  value: string;
  label?: string;
  /** The prompt that names the box, when the box stands under it alone. */
  labelledBy?: string;
  placeholder?: string;
  onAnswer: (value: string) => void;
  onDraft: (value: string) => void;
}) {
  return (
    <Textarea
      rows={1}
      className="field-sizing-fixed min-h-11 resize-none"
      dir="auto"
      aria-label={label === "" ? undefined : label}
      aria-labelledby={labelledBy}
      defaultValue={value}
      placeholder={placeholder}
      ref={(box) => {
        if (box !== null) fitBox(box);
      }}
      onChange={(event) => {
        fitBox(event.currentTarget);
        onDraft(event.currentTarget.value);
      }}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next === "") return;
        event.currentTarget.value = next;
        fitBox(event.currentTarget);
        onAnswer(next);
      }}
    />
  );
}

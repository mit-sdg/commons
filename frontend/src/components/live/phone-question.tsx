"use client";

import { useState } from "react";
import { distinctValues } from "@/components/live/rounds";
import { Input } from "@/components/ui/input";
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
  position: number;
}

/** How many of a group's words a phone shows before the rest are counted. */
const WORDS_SHOWN = 4;

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

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      {context.length === 0 ? null : (
        <div
          className={cn(
            "grid gap-2",
            context.length === 1 ? "grid-cols-1" : "grid-cols-2",
          )}
        >
          {context.map((group) => {
            const values = distinctValues(group.cards);
            const held = Math.max(0, values.length - WORDS_SHOWN);
            return (
              <div
                key={group.name}
                className="min-w-0 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5"
              >
                <p className="truncate font-medium text-xs" dir="auto">
                  {group.name}
                </p>
                {values.length === 0 ? null : (
                  <p
                    dir="auto"
                    className="text-muted-foreground text-xs leading-[1.45]"
                  >
                    {values.slice(0, WORDS_SHOWN).join(" · ")}
                    {held === 0 ? "" : ` +${held}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2
        className="font-sans text-[15px] font-medium leading-[1.45]"
        dir="auto"
      >
        {question.prompt}
      </h2>

      {question.choices.length > 0 ? (
        <div className="flex flex-col gap-2">
          {question.choices.map((choice) => (
            <button
              key={choice}
              type="button"
              dir="auto"
              // Colour alone does not carry selection to a screen reader.
              aria-pressed={answers[chosen] === choice}
              onClick={() => onAnswer(chosen, choice)}
              className={cn(
                "rounded-md border border-border px-4 py-3 text-start text-sm transition-colors",
                answers[chosen] === choice
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "hover:bg-muted",
              )}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : question.parts.length === 0 ? (
        <WrittenBox
          item={question.question}
          value={answers[question.question] ?? ""}
          placeholder="Your answer"
          onAnswer={onAnswer}
          onDraft={onDraft}
        />
      ) : repeated ? (
        <>
          <div className="flex flex-col gap-1">
            <PartLabel>{question.parts[0] ?? ""}</PartLabel>
            {items.slice(0, shown).map((item) => (
              <WrittenBox
                key={item}
                item={item}
                value={answers[item] ?? ""}
                label={question.parts[0] ?? ""}
                onAnswer={onAnswer}
                onDraft={onDraft}
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
            <label key={item} className="flex flex-col gap-1">
              <PartLabel>{label}</PartLabel>
              <WrittenBox
                item={item}
                value={answers[item] ?? ""}
                onAnswer={onAnswer}
                onDraft={onDraft}
              />
            </label>
          );
        })
      )}
    </section>
  );
}

function PartLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
      {children}
    </span>
  );
}

/**
 * The field stays uncontrolled — typing drafts, blur commits. Every blur
 * commits: the draft it would compare against is the same state typing just
 * wrote, and the sender is what knows a value it has already sent.
 */
function WrittenBox({
  item,
  value,
  label,
  placeholder,
  onAnswer,
  onDraft,
}: {
  item: string;
  value: string;
  label?: string;
  placeholder?: string;
  onAnswer: (item: string, value: string) => void;
  onDraft: (item: string, value: string) => void;
}) {
  return (
    <Input
      className="h-11"
      dir="auto"
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      onChange={(event) => onDraft(item, event.currentTarget.value)}
      onBlur={(event) => {
        const next = event.currentTarget.value.trim();
        if (next === "") return;
        event.currentTarget.value = next;
        onAnswer(item, next);
      }}
    />
  );
}

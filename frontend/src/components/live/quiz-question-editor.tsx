"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** A question as the author's own desk sees it — expectations included. */
export interface EditableQuestion {
  question: string;
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
  position: number;
}

/** What one save carries; position is the list's business, not the card's. */
export interface QuestionDraft {
  prompt: string;
  choices: string[];
  expected: string;
  explanation: string;
}

/** Choices are written one per line, and a blank line simply is not a choice. */
export function parseChoices(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/**
 * One question, edited in place. The card holds its own draft and compares it
 * against the loaded question, so "unsaved" is a fact about the two rather than
 * a flag anyone has to remember to clear.
 */
export function QuizQuestionEditor({
  index,
  question,
  isQuiz,
  locked,
  first,
  last,
  onSave,
  onRemove,
  onMove,
}: {
  index: number;
  question: EditableQuestion;
  isQuiz: boolean;
  /** A run is open: the questionnaire may be read but never moved. */
  locked: boolean;
  first: boolean;
  last: boolean;
  onSave: (draft: QuestionDraft) => Promise<void>;
  onRemove: () => Promise<void>;
  onMove: (direction: -1 | 1) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState(question.prompt);
  const [choicesText, setChoicesText] = useState(question.choices.join("\n"));
  const [expected, setExpected] = useState(question.expected);
  const [explanation, setExplanation] = useState(question.explanation);
  const [busy, setBusy] = useState(false);

  const choices = parseChoices(choicesText);
  const dirty =
    prompt !== question.prompt ||
    choices.join("\n") !== question.choices.join("\n") ||
    expected !== question.expected ||
    explanation !== question.explanation;
  const stray =
    isQuiz &&
    expected.trim() !== "" &&
    choices.length > 0 &&
    !choices.includes(expected.trim());

  async function save() {
    setBusy(true);
    try {
      await onSave({
        prompt: prompt.trim(),
        choices,
        expected: isQuiz ? expected.trim() : "",
        explanation: isQuiz ? explanation.trim() : "",
      });
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: -1 | 1) {
    setBusy(true);
    try {
      await onMove(direction);
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string) => `question-${question.question}-${name}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="eyebrow">Question {index + 1}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move up"
            disabled={locked || busy || first}
            onClick={() => void move(-1)}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Move down"
            disabled={locked || busy || last}
            onClick={() => void move(1)}
          >
            <ArrowDown />
          </Button>
          <ConfirmAction
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove question"
                disabled={locked || busy}
              >
                <Trash2 className="text-destructive" />
              </Button>
            }
            title="Remove this question?"
            description="The question and its wording are deleted. Runs already closed keep the answers they gathered."
            confirmLabel="Remove"
            destructive
            onConfirm={onRemove}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={field("prompt")}>Prompt</Label>
          <Textarea
            id={field("prompt")}
            value={prompt}
            rows={2}
            disabled={locked || busy}
            placeholder="What are you asking?"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={field("choices")}>
            Choices{" "}
            <span className="font-normal text-muted-foreground">
              (one per line — leave empty for a written answer)
            </span>
          </Label>
          <Textarea
            id={field("choices")}
            value={choicesText}
            rows={3}
            disabled={locked || busy}
            placeholder={"Paris\nBerlin\nMadrid"}
            onChange={(event) => setChoicesText(event.target.value)}
          />
        </div>

        {isQuiz ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={field("expected")}>
                Expected answer{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id={field("expected")}
                value={expected}
                disabled={locked || busy}
                placeholder="Leave empty to leave this question ungraded"
                onChange={(event) => setExpected(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {choices.length > 0
                  ? "A question with choices expects one of them, matched exactly."
                  : "A written answer is matched exactly against what you type here."}
              </p>
              {stray ? (
                <p className="text-xs text-destructive">
                  This answer is not one of the choices, so nobody can give it.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={field("explanation")}>
                Explanation{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id={field("explanation")}
                value={explanation}
                disabled={locked || busy}
                placeholder="Shown only at the fullest disclosure level"
                onChange={(event) => setExplanation(event.target.value)}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button
          size="sm"
          disabled={locked || busy || !dirty || prompt.trim() === ""}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save question"}
        </Button>
        {dirty && !locked ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </div>
  );
}

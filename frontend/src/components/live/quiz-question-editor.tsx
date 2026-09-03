"use client";

import {
  ArrowDown,
  ArrowUp,
  Circle,
  CircleCheck,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** What a card that has never been saved starts from: nothing written yet. */
const BLANK: EditableQuestion = {
  question: "new",
  prompt: "",
  choices: [],
  expected: "",
  explanation: "",
  position: 0,
};

/**
 * One question, edited in place. The card holds its own draft and compares it
 * against the loaded question, so "unsaved" is a fact about the two rather than
 * a flag anyone has to remember to clear.
 *
 * Choices are structured rows. On a quiz, the answer is marked on its row and
 * follows the row through edits, so retyping the answer text is never asked
 * for; a question with no rows takes a written answer, which is never graded —
 * its expected answer is a reference.
 *
 * A null question is a card for a question that does not exist yet: it lives
 * only in the browser until its first save, so no placeholder wording can ride
 * into a run.
 */
export function QuizQuestionEditor({
  index,
  question,
  isQuiz,
  locked,
  first = false,
  last = false,
  onSave,
  onRemove,
  onMove,
  onDirtyChange,
}: {
  index: number;
  /** Null while the question has never been saved. */
  question: EditableQuestion | null;
  isQuiz: boolean;
  /** A run is open: the questionnaire may be read but never moved. */
  locked: boolean;
  first?: boolean;
  last?: boolean;
  onSave: (draft: QuestionDraft) => Promise<void>;
  /** Deletes a saved question; simply discards an unsaved one. */
  onRemove: () => Promise<void>;
  onMove?: (direction: -1 | 1) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const unsaved = question === null;
  const saved = question ?? BLANK;
  const [prompt, setPrompt] = useState(saved.prompt);
  const [choices, setChoices] = useState<string[]>(saved.choices);
  // The marked row is held by position, so editing the answer's text keeps it
  // the answer.
  const [correct, setCorrect] = useState<number | null>(() => {
    const marked = saved.choices.indexOf(saved.expected);
    return marked === -1 ? null : marked;
  });
  const [reference, setReference] = useState(
    saved.choices.length === 0 ? saved.expected : "",
  );
  const [explanation, setExplanation] = useState(saved.explanation);
  const [busy, setBusy] = useState(false);
  const onDirtyChangeRef = useRef(onDirtyChange);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const choiceRefs = useRef<(HTMLInputElement | null)[]>([]);
  const caretRow = useRef<number | null>(null);

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  // A fresh card is where the author is already looking, so put the caret there.
  useEffect(() => {
    if (unsaved) promptRef.current?.focus();
  }, [unsaved]);

  // A row added or removed from the keyboard takes the caret with it.
  useEffect(() => {
    if (caretRow.current === null) return;
    choiceRefs.current[caretRow.current]?.focus();
    caretRow.current = null;
  });

  const written = choices.length === 0;
  const cleaned = choices
    .map((choice) => choice.trim())
    .filter((choice) => choice !== "");
  const expected = !isQuiz
    ? ""
    : written
      ? reference.trim()
      : correct === null
        ? ""
        : (choices[correct] ?? "").trim();
  const normalizedPrompt = prompt.trim();
  const normalizedExplanation = isQuiz ? explanation.trim() : "";
  const dirty =
    normalizedPrompt !== saved.prompt ||
    cleaned.join("\n") !== saved.choices.join("\n") ||
    expected !== saved.expected ||
    normalizedExplanation !== saved.explanation;
  const duplicateChoices = cleaned.some(
    (choice, row) =>
      cleaned.findIndex(
        (candidate) => candidate.toLowerCase() === choice.toLowerCase(),
      ) !== row,
  );
  // A saved answer that no longer matches any row would save back as ungraded;
  // say so until a row is marked.
  const stray =
    isQuiz &&
    !written &&
    correct === null &&
    saved.expected !== "" &&
    !cleaned.includes(saved.expected);

  useEffect(() => {
    onDirtyChangeRef.current?.(dirty);
    return () => onDirtyChangeRef.current?.(false);
  }, [dirty]);

  function editChoice(row: number, text: string) {
    setChoices((prev) => prev.map((choice, i) => (i === row ? text : choice)));
  }

  function insertChoice(row: number) {
    setChoices((prev) => [
      ...prev.slice(0, row + 1),
      "",
      ...prev.slice(row + 1),
    ]);
    setCorrect((prev) => (prev !== null && prev > row ? prev + 1 : prev));
    caretRow.current = row + 1;
  }

  function appendChoice() {
    caretRow.current = choices.length;
    setChoices((prev) => [...prev, ""]);
  }

  function removeChoice(row: number) {
    setChoices((prev) => prev.filter((_, i) => i !== row));
    setCorrect((prev) =>
      prev === null ? null : prev === row ? null : prev > row ? prev - 1 : prev,
    );
  }

  function keyChoice(
    row: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      insertChoice(row);
    }
    if (event.key === "Backspace" && choices[row] === "") {
      event.preventDefault();
      removeChoice(row);
      if (row > 0) caretRow.current = row - 1;
    }
  }

  async function save() {
    setBusy(true);
    try {
      await onSave({
        prompt: normalizedPrompt,
        choices: cleaned,
        expected,
        explanation: normalizedExplanation,
      });
    } finally {
      setBusy(false);
    }
  }

  async function move(direction: -1 | 1) {
    if (onMove === undefined) return;
    setBusy(true);
    try {
      await onMove(direction);
    } finally {
      setBusy(false);
    }
  }

  const field = (name: string) => `question-${saved.question}-${name}`;

  const explanationField = (
    <div className="space-y-1.5">
      <Label htmlFor={field("explanation")}>
        Explanation{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <Input
        id={field("explanation")}
        value={explanation}
        maxLength={2000}
        disabled={locked || busy}
        onChange={(event) => setExplanation(event.target.value)}
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="eyebrow">
          {unsaved ? "New question" : `Question ${index + 1}`}
        </p>
        <div className="flex items-center gap-1">
          {unsaved ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Discard this question"
              disabled={busy}
              onClick={() => void onRemove()}
            >
              <Trash2 className="text-destructive" />
            </Button>
          ) : (
            <>
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
                description="The question and its wording are deleted. Closed runs keep the answers they gathered."
                confirmLabel="Remove"
                destructive
                onConfirm={onRemove}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={field("prompt")}>Prompt</Label>
          <Textarea
            id={field("prompt")}
            ref={promptRef}
            value={prompt}
            maxLength={10000}
            rows={2}
            disabled={locked || busy}
            placeholder="What are you asking?"
            onChange={(event) => setPrompt(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Choices</Label>
          {written ? (
            <p className="text-muted-foreground text-sm">
              No choices. The answer is written.
            </p>
          ) : (
            <div className="space-y-2">
              {choices.map((choice, row) => (
                <div
                  // Rows have no identity of their own; the position is the key.
                  // biome-ignore lint/suspicious/noArrayIndexKey: values are controlled
                  key={row}
                  className="flex items-center gap-2"
                >
                  {isQuiz ? (
                    <button
                      type="button"
                      aria-label={
                        correct === row ? "The answer" : "Mark as the answer"
                      }
                      aria-pressed={correct === row}
                      disabled={locked || busy}
                      onClick={() =>
                        setCorrect((prev) => (prev === row ? null : row))
                      }
                      className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                    >
                      {correct === row ? (
                        <CircleCheck className="size-5 text-primary" />
                      ) : (
                        <Circle className="size-5 text-muted-foreground" />
                      )}
                    </button>
                  ) : null}
                  <Input
                    ref={(element) => {
                      choiceRefs.current[row] = element;
                    }}
                    value={choice}
                    maxLength={500}
                    aria-label={`Choice ${row + 1}`}
                    disabled={locked || busy}
                    onChange={(event) => editChoice(row, event.target.value)}
                    onKeyDown={(event) => keyChoice(row, event)}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove choice"
                    disabled={locked || busy}
                    onClick={() => removeChoice(row)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={locked || busy || choices.length >= 50}
            onClick={appendChoice}
          >
            <Plus /> Add choice
          </Button>
          {stray ? (
            <p className="text-xs text-destructive">
              Answer does not match any choice.
            </p>
          ) : null}
          {duplicateChoices ? (
            <p className="text-xs text-destructive">
              Choice labels must be different, ignoring capitalization.
            </p>
          ) : null}
        </div>

        {isQuiz ? (
          written ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={field("reference")}>
                  Reference answer{" "}
                  <span className="font-normal text-muted-foreground">
                    (not graded)
                  </span>
                </Label>
                <Input
                  id={field("reference")}
                  value={reference}
                  maxLength={2000}
                  disabled={locked || busy}
                  onChange={(event) => setReference(event.target.value)}
                />
              </div>
              {explanationField}
            </div>
          ) : (
            explanationField
          )
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          disabled={
            locked ||
            busy ||
            !dirty ||
            normalizedPrompt === "" ||
            duplicateChoices
          }
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save question"}
        </Button>
        {unsaved ? (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void onRemove()}
          >
            Cancel
          </Button>
        ) : dirty && !locked ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </div>
  );
}

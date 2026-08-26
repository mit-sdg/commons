"use client";

import {
  Check,
  CircleAlert,
  Loader2,
  MessageCircleQuestion,
  PencilLine,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@/components/link";
import { FormBadge } from "@/components/live/quiz-meta";
import { Spinner } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Output } from "@/lib/api";
import { cn } from "@/lib/utils";

export type DraftLineStep = Output<"/live/drafts/line">["line"][number];
type DraftItem = DraftLineStep["items"][number];
type DraftClarification = DraftLineStep["clarifications"][number];

/**
 * One drafted item, read the way its author needs to read it: the prompt, the
 * choices with the expected one marked, and the explanation. This is the
 * author's desk, so nothing a respondent would not see is hidden here.
 */
function DraftItemRow({ item }: { item: DraftItem }) {
  return (
    <li className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-3">
      {/* The number sits in its own column so a wrapped prompt keeps its
          hanging indent on a narrow screen. */}
      <div className="flex items-start gap-2 text-sm font-medium">
        <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
          {item.position}.
        </span>
        <p dir="auto" className="min-w-0 flex-1">
          {item.prompt}
        </p>
      </div>

      {/* Everything under the prompt shares its text edge, past the number. */}
      <div className="space-y-2 ps-8">
        {item.choices.length > 0 ? (
          <ul className="space-y-1">
            {item.choices.map((choice) => {
              const expected = item.expected !== "" && choice === item.expected;
              return (
                <li
                  key={choice}
                  className={cn(
                    "flex items-start gap-2 text-sm text-muted-foreground",
                    expected && "font-medium text-foreground",
                  )}
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
                    {expected ? (
                      <Check className="size-3.5" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                    )}
                  </span>
                  <span dir="auto" className="min-w-0 flex-1">
                    {choice}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Written answer</p>
        )}

        {item.expected !== "" && !item.choices.includes(item.expected) ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Reference: </span>
            <span dir="auto">{item.expected}</span>
          </p>
        ) : null}

        {item.explanation !== "" ? (
          <p dir="auto" className="text-sm text-muted-foreground">
            {item.explanation}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * How long the current wait has run. It mounts with the wait and unmounts with
 * it, so every wait counts from zero; it is hidden from assistive tech, whose
 * announcement of the wait should not repeat once a second.
 */
function WaitingElapsed() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span aria-hidden="true" className="tabular-nums">
      {seconds}s
    </span>
  );
}

/** An answered clarification, kept in the thread so the line reads whole. */
function AnsweredClarification({
  clarification,
}: {
  clarification: DraftClarification;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-background px-4 py-3">
      <p className="flex items-start gap-2 text-sm">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>{clarification.question}</span>
      </p>
      <p className="pl-6 text-sm text-muted-foreground">
        {clarification.answer}
      </p>
    </div>
  );
}

/** The open clarification: one question, one answer, and drafting resumes. */
function ClarificationPrompt({
  clarification,
  busy,
  onClarify,
}: {
  clarification: DraftClarification;
  busy: boolean;
  onClarify: (clarification: string, answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const ready = answer.trim().length > 0;

  function send() {
    if (!ready || busy) return;
    onClarify(clarification.clarification, answer.trim());
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card px-4 py-3">
      <p className="flex items-start gap-2 text-sm">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <span>{clarification.question}</span>
      </p>
      <div className="flex flex-col gap-2 pl-6 sm:flex-row">
        <Input
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder="Answer the question…"
          aria-label="Answer the clarifying question"
        />
        <Button onClick={send} disabled={!ready || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Answer
        </Button>
      </div>
    </div>
  );
}

/** The correction box under the tip's draft: plain language, same as before. */
function CorrectionBox({
  candidate,
  busy,
  onCorrect,
}: {
  candidate: string;
  busy: boolean;
  onCorrect: (candidate: string, request: string) => void;
}) {
  const [request, setRequest] = useState("");
  const ready = request.trim().length > 0;

  function send() {
    if (!ready || busy) return;
    onCorrect(candidate, request.trim());
    setRequest("");
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={request}
          onChange={(event) => setRequest(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder="e.g. make question 3 harder"
          aria-label="Request a change to this draft"
        />
        <Button variant="outline" onClick={send} disabled={!ready || busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PencilLine className="size-4" />
          )}
          Request a change
        </Button>
      </div>
    </div>
  );
}

/**
 * One step of the drafting line — the request that opened it and whatever came
 * back. The tip carries the affordances: answering a clarifying question,
 * asking for a change, and adopting.
 */
export function DraftStep({
  step,
  position,
  isTip,
  waiting,
  busy,
  adopting,
  refiningForm,
  onClarify,
  onCorrect,
  onAdopt,
  onStartOver,
}: {
  step: DraftLineStep;
  position: number;
  isTip: boolean;
  waiting: boolean;
  busy: boolean;
  adopting: boolean;
  refiningForm: DraftLineStep["form"];
  onClarify: (clarification: string, answer: string) => void;
  onCorrect: (candidate: string, request: string) => void;
  onAdopt: (candidate: string) => void;
  onStartOver: () => void;
}) {
  const openClarification =
    step.clarifications.find((entry) => entry.answer === null) ?? null;
  const answered = step.clarifications.filter((entry) => entry.answer !== null);
  const candidate = step.candidate;
  // Where an adopted draft went: the questionnaire adoption composed, or the
  // one this line was refining. Without either the quizzes page is all we can
  // point at.
  const questionnaire = step.composed ?? step.refines;
  // A refining line opens on the questionnaire's own questions, so this
  // candidate is that questionnaire verbatim until a correction moves it —
  // adopting it would apply nothing.
  const uncorrected = step.refines !== null && step.basis === null;
  const changedForm =
    refiningForm !== null && step.form !== null && step.form !== refiningForm;

  return (
    <article className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">Step {position}</Badge>
        {isTip ? <Badge variant="outline">Current</Badge> : null}
        {step.adopted ? <Badge>Adopted</Badge> : null}
      </div>

      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <p className="eyebrow mb-1">
          {position === 1 ? "Your description" : "Your correction"}
        </p>
        <p dir="auto" className="whitespace-pre-wrap text-sm">
          {step.request}
        </p>
      </div>

      {answered.map((entry) => (
        <AnsweredClarification
          key={entry.clarification}
          clarification={entry}
        />
      ))}

      {openClarification && isTip ? (
        <ClarificationPrompt
          clarification={openClarification}
          busy={busy}
          onClarify={onClarify}
        />
      ) : null}

      {openClarification && !isTip ? (
        <div className="rounded-xl border border-border bg-background px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0" />
            <span>{openClarification.question}</span>
          </p>
        </div>
      ) : null}

      {candidate !== null ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drafted questions</CardTitle>
            <CardAction>
              {step.form !== null ? (
                <FormBadge form={step.form} />
              ) : (
                <Badge variant="outline">Draft</Badge>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            {step.items.length > 0 ? (
              <ul className="space-y-3">
                {step.items.map((item) => (
                  <DraftItemRow
                    key={`${candidate}-${item.position}`}
                    item={item}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                This draft has no items.
              </p>
            )}

            {isTip ? (
              <div className="space-y-4 border-t border-border pt-4">
                {step.adopted ? (
                  <div className="space-y-2">
                    {questionnaire === null ? (
                      <p className="text-sm text-muted-foreground">
                        Composing the questionnaire…
                      </p>
                    ) : null}
                    <Link
                      href={
                        questionnaire !== null
                          ? `/staff/live/${questionnaire}`
                          : "/staff/live"
                      }
                      className="text-sm font-medium underline underline-offset-4 hover:text-primary"
                    >
                      {questionnaire !== null
                        ? "Open the questionnaire"
                        : "Back to Live"}
                    </Link>
                  </div>
                ) : (
                  <>
                    {changedForm ? (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <p className="flex items-start gap-2">
                          <CircleAlert className="mt-0.5 size-4 shrink-0" />
                          <span>
                            This questionnaire is a {refiningForm}, but this
                            draft is a {step.form}. Its form cannot be changed
                            here. Ask AI to keep it as a {refiningForm}.
                          </span>
                        </p>
                      </div>
                    ) : uncorrected ? null : (
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          onClick={() => onAdopt(candidate)}
                          disabled={adopting || busy}
                        >
                          {adopting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Check className="size-4" />
                          )}
                          Adopt this draft
                        </Button>
                      </div>
                    )}
                    <CorrectionBox
                      candidate={candidate}
                      busy={busy}
                      onCorrect={onCorrect}
                    />
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {isTip && waiting ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground"
        >
          <Spinner className="size-4" />
          <span>Drafting…</span>
          <WaitingElapsed />
        </div>
      ) : null}

      {isTip && step.stalled ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>No usable draft came back.</span>
          </p>
          <Button variant="outline" size="sm" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      ) : null}
    </article>
  );
}

"use client";

import {
  Check,
  CircleAlert,
  Loader2,
  MessageCircleQuestion,
  PencilLine,
} from "lucide-react";
import { useState } from "react";
import { Link } from "@/components/link";
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
      <p className="text-sm font-medium">
        <span className="mr-2 text-muted-foreground tabular-nums">
          {item.position}.
        </span>
        {item.prompt}
      </p>

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
                <span>{choice}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">Written answer</p>
      )}

      {item.expected !== "" && !item.choices.includes(item.expected) ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Expected answer: </span>
          {item.expected}
        </p>
      ) : null}

      {item.explanation !== "" ? (
        <p className="text-sm text-muted-foreground">{item.explanation}</p>
      ) : null}
    </li>
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
          placeholder="Request a change — e.g. make question 3 harder"
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
      <p className="text-xs text-muted-foreground">
        Only what you ask for changes; the rest of the draft is carried over.
      </p>
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
  onClarify: (clarification: string, answer: string) => void;
  onCorrect: (candidate: string, request: string) => void;
  onAdopt: (candidate: string) => void;
  onStartOver: () => void;
}) {
  const openClarification =
    step.clarifications.find((entry) => entry.answer === null) ?? null;
  const answered = step.clarifications.filter((entry) => entry.answer !== null);
  const candidate = step.candidate;

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
        <p className="whitespace-pre-wrap text-sm">{step.request}</p>
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
              <Badge variant="outline">{step.form ?? "draft"}</Badge>
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
                    <p className="text-sm text-muted-foreground">
                      This draft has been adopted. It is an ordinary
                      questionnaire now — revise it on its own page.
                    </p>
                    <Link
                      href="/staff/live"
                      className="text-sm font-medium underline underline-offset-4 hover:text-primary"
                    >
                      Open the quizzes page
                    </Link>
                  </div>
                ) : (
                  <>
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
                      <p className="text-sm text-muted-foreground">
                        Adopting makes it an editable questionnaire; corrections
                        stop here.
                      </p>
                    </div>
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
          <span>Waiting on the reasoner…</span>
        </div>
      ) : null}

      {isTip && step.stalled ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="flex items-start gap-2 text-sm text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              The reasoner could not produce a usable draft from this request.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={onStartOver}>
            Start over
          </Button>
        </div>
      ) : null}
    </article>
  );
}

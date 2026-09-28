"use client";

import type { RefObject } from "react";
import { Fact } from "@/components/facts";
import { RenderedMarkdown } from "@/components/forum/rendered-markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isBlank,
  type LearnerResult,
  type Level,
  type Paper,
} from "@/lib/grade-analysis";
import { cn } from "@/lib/utils";
import { LEVEL_FILL, LEVEL_NAMES, type Rating, RING, score } from "./common";
import type { Naming } from "./names";

function PaperLetter({
  grader,
  names,
}: {
  grader: string | null;
  names: Naming;
}) {
  return (
    <span
      title={names.grader(grader)}
      className={cn(
        "rounded border border-border px-1 text-center text-xs font-semibold whitespace-nowrap text-muted-foreground",
        names.mine(grader) && "border-foreground text-foreground",
      )}
    >
      {names.grader(grader, "short")}
    </span>
  );
}

function FeedbackText({ text, clamp }: { text: string; clamp?: boolean }) {
  return isBlank(text) ? (
    <span className="text-muted-foreground italic">No feedback</span>
  ) : (
    <span className={clamp ? "line-clamp-3" : undefined}>{text.trim()}</span>
  );
}

export function PaperButton({
  paper,
  names,
  onPaper,
  lettered,
}: {
  paper: Paper;
  names: Naming;
  onPaper: (submission: string) => void;
  lettered?: boolean;
}) {
  const student = names.student(paper);
  return (
    <button
      type="button"
      onClick={() => onPaper(paper.submission)}
      className={cn(
        "w-full rounded-md px-1.5 py-1 text-left text-sm hover:bg-accent",
        lettered &&
          "grid grid-cols-[minmax(1.5rem,max-content)_minmax(0,1fr)] items-baseline gap-2",
        RING,
      )}
    >
      {lettered ? <PaperLetter grader={paper.grader} names={names} /> : null}
      <span className="min-w-0">
        {student ? (
          <span className="block text-xs text-muted-foreground">{student}</span>
        ) : null}
        <FeedbackText text={paper.feedback} clamp />
      </span>
    </button>
  );
}

export function PaperCard({
  paper,
  names,
  heading,
  label,
}: {
  paper: Paper;
  names: Naming;
  heading: string;
  label: string;
}) {
  const student = names.student(paper);
  return (
    <>
      <span className="flex justify-between gap-3 font-semibold">
        <span>{student ?? names.grader(paper.grader)}</span>
        <span className="tabular-nums">{heading}</span>
      </span>
      {student ? (
        <span className="text-muted-foreground">
          {names.grader(paper.grader)}
        </span>
      ) : null}
      <span className="pt-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="line-clamp-4">
        <FeedbackText text={paper.feedback} />
      </span>
    </>
  );
}

export function PaperDialog({
  result,
  text,
  names,
  opener,
  onClose,
  onOpenInSubmissions,
}: {
  result: LearnerResult | null;
  text: string[] | null;
  names: Naming;
  opener: RefObject<HTMLElement | null>;
  onClose: () => void;
  onOpenInSubmissions: (submission: string) => void;
}) {
  const assessment = result?.assessment;
  const submission = result?.attempt ? String(result.attempt.submission) : null;
  const student = result ? names.student(result) : null;
  const criteria = [...(assessment?.criteria ?? [])].sort(
    (left, right) => left.position - right.position,
  );
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="text-sm sm:max-w-3xl"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById("paper-title")?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle id="paper-title" tabIndex={-1} className="outline-none">
            {student ?? "Paper"}
          </DialogTitle>
          {result ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span>
                {names.grader(result.grader)}
                {result.attempt ? `, attempt ${result.attempt.number}` : ""}
              </span>
              {assessment ? <Fact.Status status={assessment.status} /> : null}
            </div>
          ) : null}
        </DialogHeader>
        {assessment ? (
          <dl className="space-y-3">
            {criteria.map((criterion) => {
              const judgment = assessment.judgments.find(
                (entry) => entry.criterion === criterion.criterion,
              );
              return (
                <div key={criterion.criterion} className="space-y-1">
                  <dt className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{criterion.name}</span>
                    {judgment?.kind === "COMPETENCY" ? (
                      <span className="inline-flex items-center gap-1.5">
                        {judgment.rating in LEVEL_FILL ? (
                          <span
                            aria-hidden
                            className={cn(
                              "size-3 rounded-sm",
                              LEVEL_FILL[judgment.rating as Level],
                            )}
                          />
                        ) : null}
                        {LEVEL_NAMES[judgment.rating as Rating] ??
                          judgment.rating}
                      </span>
                    ) : judgment?.kind === "POINTS" &&
                      criterion.kind === "POINTS" ? (
                      <span className="tabular-nums">
                        {score(judgment.score)} of {score(criterion.maxPoints)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not rated</span>
                    )}
                  </dt>
                  {judgment?.kind === "COMPETENCY" ? (
                    <dd
                      className={
                        isBlank(judgment.feedback)
                          ? "text-muted-foreground italic"
                          : "whitespace-pre-wrap"
                      }
                    >
                      {isBlank(judgment.feedback)
                        ? "No feedback"
                        : judgment.feedback.trim()}
                    </dd>
                  ) : null}
                </div>
              );
            })}
            {!isBlank(assessment.feedback) ? (
              <div className="space-y-1">
                <dt className="font-medium">Overall feedback</dt>
                <dd className="whitespace-pre-wrap">
                  {assessment.feedback.trim()}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <div className="border-t border-border pt-3">
          {text === null ? (
            <p className="text-muted-foreground">Loading the paper…</p>
          ) : text.every((html) => html === "") ? (
            <p className="text-muted-foreground">
              Submission content is unavailable.
            </p>
          ) : (
            text.map((html, index) =>
              html ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: artifacts keep their order
                <RenderedMarkdown key={index} html={html} />
              ) : null,
            )
          )}
        </div>
        {submission ? (
          <DialogFooter>
            <Button
              className={RING}
              variant="outline"
              onClick={() => onOpenInSubmissions(submission)}
            >
              Open in Submissions
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

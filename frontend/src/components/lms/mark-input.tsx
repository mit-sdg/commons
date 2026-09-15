"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Fact, Facts } from "@/components/facts";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { type Mark, MarkCard } from "./mark-history";

export function MarkInput({
  learner,
  learnerLabel,
  item,
  itemLabel,
  evidence = "",
  generation,
  maxPoints,
  onSaved,
}: {
  learner: string;
  learnerLabel: string;
  item: string;
  itemLabel: string;
  evidence?: string;
  generation: number;
  maxPoints: number;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.marks["for-item"]({ item })) : null,
    [session, learner, item, generation],
  );
  const mark = query.data?.marks.find((entry) => entry.learner === learner);
  if (query.loading && !query.data)
    return <LoadingState label="Loading point grade…" />;
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.refetch} />;
  return (
    <MarkEditor
      key={`${mark?.mark ?? "new"}-${mark?.version ?? 0}-${evidence}`}
      mark={mark}
      learner={learner}
      learnerLabel={learnerLabel}
      item={item}
      itemLabel={itemLabel}
      evidence={evidence}
      generation={generation}
      maxPoints={maxPoints}
      onSaved={() => {
        query.refetch();
        onSaved();
      }}
    />
  );
}

function MarkEditor({
  mark,
  learner,
  learnerLabel,
  item,
  itemLabel,
  evidence,
  generation,
  maxPoints,
  onSaved,
}: {
  mark?: Mark;
  learner: string;
  learnerLabel: string;
  item: string;
  itemLabel: string;
  evidence: string;
  generation: number;
  maxPoints: number;
  onSaved: () => void;
}) {
  const [score, setScore] = useState(mark?.scored ? String(mark.score) : "");
  const [feedback, setFeedback] = useState(mark?.feedback ?? "");
  const [busy, setBusy] = useState(false);
  const numericScore = Number(score);
  const scoreValid =
    score.trim() !== "" &&
    Number.isFinite(numericScore) &&
    numericScore >= 0 &&
    numericScore <= maxPoints;
  const dirty =
    score !== (mark?.scored ? String(mark.score) : "") ||
    feedback !== (mark?.feedback ?? "") ||
    (Boolean(mark) && evidence !== mark?.evidence);

  async function save() {
    if (!scoreValid) return;
    setBusy(true);
    try {
      const result = await api.marks.record({
        learner,
        item,
        evidence,
        score: numericScore,
        feedback,
        generation,
        version: mark?.version ?? 0,
      });
      if ("error" in result)
        toast.error(
          result.error === "CONFLICT"
            ? "This grade or its grading setup changed. Reload before saving."
            : publicErrorMessage(result.error),
        );
      else {
        toast.success("Point grade saved as a draft");
        onSaved();
      }
    } catch {
      toast.error(
        "The save outcome could not be confirmed. Grades were refreshed before retrying.",
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function transition(kind: "release" | "retract" | "restore-excused") {
    if (!mark) return;
    setBusy(true);
    try {
      const result = await api.marks[kind]({
        mark: mark.mark,
        version: mark.version,
      });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        toast.success(
          kind === "release" ? "Point grade released" : "Point grade updated",
        );
        onSaved();
      }
    } catch {
      toast.error(
        "The update outcome could not be confirmed. Grades were refreshed before retrying.",
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  async function excuse() {
    setBusy(true);
    try {
      const result = await api.marks.excuse({
        learner,
        item,
        evidence,
        feedback,
        generation,
        mark: mark?.mark ?? "",
        version: mark?.version ?? 0,
      });
      if ("error" in result) toast.error(publicErrorMessage(result.error));
      else {
        toast.success("Assignment marked excused");
        onSaved();
      }
    } catch {
      toast.error(
        "The excusal outcome could not be confirmed. Grades were refreshed before retrying.",
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (mark && mark.status !== "DRAFT")
    return (
      <div className="space-y-3">
        <MarkCard mark={mark} staff />
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() =>
            void transition(
              mark.status === "EXCUSED" ? "restore-excused" : "retract",
            )
          }
        >
          {mark.status === "EXCUSED" ? "Revoke excusal" : "Retract to correct"}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <Facts className="text-sm">
        <span className="font-medium">{learnerLabel}</span>
        <Fact.Where>{itemLabel}</Fact.Where>
        <span className="text-muted-foreground">Visible only to staff</span>
      </Facts>
      <div className="space-y-2">
        <Label htmlFor={`point-score-${learner}-${item}`}>
          Score / {maxPoints}
        </Label>
        <Input
          id={`point-score-${learner}-${item}`}
          type="number"
          inputMode="decimal"
          min={0}
          max={maxPoints}
          step="any"
          className="w-36"
          value={score}
          disabled={busy}
          aria-invalid={score !== "" && !scoreValid}
          onChange={(event) => setScore(event.target.value)}
          placeholder="Not graded"
        />
        {score !== "" && !scoreValid ? (
          <p className="text-xs text-destructive">
            Enter a score from 0 through {maxPoints}.
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`point-feedback-${learner}-${item}`}>
          Feedback (optional)
        </Label>
        <Textarea
          id={`point-feedback-${learner}-${item}`}
          maxLength={20000}
          value={feedback}
          disabled={busy}
          onChange={(event) => setFeedback(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || !evidence || !scoreValid || !dirty}
          onClick={() => void save()}
        >
          Save draft
        </Button>
        <ConfirmAction
          title={`Release ${score || "this grade"} / ${maxPoints}?`}
          description="The score and feedback will become visible to the learner."
          confirmLabel="Release grade"
          onConfirm={() => transition("release")}
          trigger={
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !mark?.scored || dirty}
            >
              Release
            </Button>
          }
        />
        <ConfirmAction
          title={`Excuse ${learnerLabel}?`}
          description="The learner will see an excused result and the feedback shown here, but no score."
          confirmLabel="Mark excused"
          onConfirm={excuse}
          trigger={
            <Button size="sm" variant="ghost" disabled={busy}>
              Excuse assignment
            </Button>
          }
        />
      </div>
      {!evidence ? (
        <p className="text-xs text-muted-foreground">
          Select a submitted attempt before saving a score. Excusal does not
          require an attempt.
        </p>
      ) : null}
    </div>
  );
}

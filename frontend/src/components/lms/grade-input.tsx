"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, publicErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface GradeInputProps {
  learner: string;
  learnerLabel?: string;
  item: string;
  itemLabel?: string;
  currentScore?: number;
  currentFeedback?: string;
  currentStatus?: string;
  evidence?: string;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  className?: string;
}

export function GradeInput({
  learner,
  learnerLabel,
  item,
  itemLabel,
  currentScore,
  currentFeedback,
  currentStatus,
  evidence,
  onSaved,
  onDirtyChange,
  className,
}: GradeInputProps) {
  const { session } = useAuth();
  const [score, setScore] = useState(currentScore ?? 0);
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [loading, setLoading] = useState(false);
  const dirty =
    score !== (currentScore ?? 0) || feedback !== (currentFeedback ?? "");

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const itemQuery = useQuery(
    currentStatus === "DRAFT" ? () => api.grades.item({ item }) : null,
    [item, currentStatus],
  );
  const scoresQuery = useQuery(
    currentStatus === "DRAFT"
      ? () => api.grades["criterion-scores"]({ learner, item })
      : null,
    [learner, item, currentStatus],
  );

  async function save() {
    if (!session) return;
    setLoading(true);
    const result = await api.grades.record({
      learner,
      item,
      score,
      feedback,
      evidence: evidence ?? "",
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Grade saved");
      onSaved();
    }
  }

  async function release() {
    if (!session) return;
    setLoading(true);
    const result = await api.grades.release({ learner, item });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Grade released");
      onSaved();
    }
  }

  async function retract() {
    if (!session) return;
    setLoading(true);
    const result = await api.grades.retract({ learner, item });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Grade retracted to draft");
      onSaved();
    }
  }

  async function restoreExcused() {
    if (!session) return;
    setLoading(true);
    const result = await api.grades["restore-excused"]({ learner, item });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Excused grade restored to draft");
      onSaved();
    }
  }

  async function excuse() {
    if (!session) return;
    const excuseFeedback = feedback || "Excused";
    setLoading(true);
    const result = await api.grades.excuse({
      learner,
      item,
      feedback: excuseFeedback,
    });
    setLoading(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success("Learner excused");
      onSaved();
    }
  }

  const locked = currentStatus === "RELEASED" || currentStatus === "EXCUSED";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2">
        <Label htmlFor={`grade-score-${learner}-${item}`}>Score</Label>
        <Input
          id={`grade-score-${learner}-${item}`}
          type="number"
          min={0}
          value={score}
          onChange={(e) => setScore(Number(e.target.value))}
          disabled={loading || locked}
          className="w-32"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`grade-feedback-${learner}-${item}`}>Feedback</Label>
        <Textarea
          id={`grade-feedback-${learner}-${item}`}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          disabled={loading || locked}
          rows={3}
          placeholder="Optional feedback for the learner..."
        />
      </div>
      {currentStatus === "DRAFT" &&
      itemQuery.data &&
      !("error" in itemQuery.data) &&
      itemQuery.data.criteria.length > 0 ? (
        <fieldset className="space-y-3 rounded-lg border border-border bg-muted/25 p-3">
          <legend className="px-1 text-sm font-medium">Rubric scores</legend>
          {itemQuery.data.criteria.map((criterion) => {
            const existing =
              scoresQuery.data && !("error" in scoresQuery.data)
                ? scoresQuery.data.scores.find(
                    (score) =>
                      String(score.criterion) === String(criterion.criterion),
                  )
                : undefined;
            return (
              <CriterionScoreField
                key={String(criterion.criterion)}
                learner={learner}
                item={item}
                criterion={String(criterion.criterion)}
                name={criterion.name}
                maxPoints={criterion.maxPoints}
                initialPoints={existing?.points}
                initialFeedback={existing?.feedback}
                onSaved={scoresQuery.refetch}
              />
            );
          })}
        </fieldset>
      ) : null}

      {currentStatus === "RELEASED" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Retract this released grade before changing its score or feedback.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={retract}
            disabled={loading}
          >
            Retract to edit
          </Button>
        </div>
      ) : currentStatus === "EXCUSED" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This learner is excused. Restore the grade to draft before editing
            it.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={restoreExcused}
            disabled={loading}
          >
            Restore to draft
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={loading}>
            Save draft
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={release}
            disabled={loading || !currentStatus}
          >
            Release
          </Button>
          <ConfirmAction
            title={`Excuse ${learnerLabel ?? learner}?`}
            description={`${itemLabel ?? item} will be marked excused with the feedback currently shown: ${feedback || "Excused"}`}
            confirmLabel="Excuse learner"
            onConfirm={excuse}
            trigger={
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={loading || !currentStatus}
              >
                Excuse
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}

function CriterionScoreField({
  learner,
  item,
  criterion,
  name,
  maxPoints,
  initialPoints,
  initialFeedback,
  onSaved,
}: {
  learner: string;
  item: string;
  criterion: string;
  name: string;
  maxPoints: number;
  initialPoints?: number;
  initialFeedback?: string;
  onSaved: () => void;
}) {
  const [points, setPoints] = useState(initialPoints ?? 0);
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await api.grades["score-criterion"]({
      learner,
      item,
      criterion,
      points,
      feedback,
    });
    setBusy(false);
    if ("error" in result) toast.error(publicErrorMessage(result.error));
    else {
      toast.success(`${name} score saved`);
      onSaved();
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor={`criterion-feedback-${learner}-${criterion}`}>
          {name} feedback
        </Label>
        <Input
          id={`criterion-feedback-${learner}-${criterion}`}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Optional feedback"
          disabled={busy}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`criterion-points-${learner}-${criterion}`}>
          Points / {maxPoints}
        </Label>
        <Input
          id={`criterion-points-${learner}-${criterion}`}
          type="number"
          min={0}
          max={maxPoints}
          value={points}
          onChange={(event) => setPoints(Number(event.target.value))}
          disabled={busy}
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={save}
        disabled={busy || points < 0 || points > maxPoints}
      >
        Save
      </Button>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Fact, Facts } from "@/components/facts";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@/hooks/use-query";
import { api, isClientErrorCode, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  type Assessment,
  type CompetencyJudgment,
  competencyCriteria,
  competencyJudgments,
  type GradingSetup,
  pointCriteria,
  pointJudgments,
  type Rating,
} from "@/lib/grading";
import { sumDecimals } from "../../../../src/computations/decimal-sum.ts";
import {
  AssessmentCard,
  LEVELS,
  levelDescription,
  levelLabel,
  RubricDescription,
} from "./assessment-history";
import { GradingDataNotice } from "./grading-data-notice";

interface Props {
  learner: string;
  item: string;
  evidence?: string;
  learnerLabel?: string;
  itemLabel?: string;
  recordVersion?: number;
  onSaved: () => void;
  className?: string;
  disabled?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}
export function AssessmentInput({
  learner,
  item,
  evidence = "",
  learnerLabel,
  itemLabel,
  recordVersion,
  onSaved,
  className,
  disabled = false,
  onDirtyChange,
}: Props) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.grades["for-item"]({ item })) : null,
    [session, learner, item, evidence],
    { retainOnTransportError: true },
  );
  const setup = useQuery(
    session ? async () => unwrap(await api.grades.item({ item })) : null,
    [session, item],
    { retainOnTransportError: true },
  );
  const [busy, setBusy] = useState(false);
  const assessment = query.data?.grades.find(
    (a) => a.learner === learner && a.evidence === evidence,
  ) as Assessment | undefined;
  const currentSetup = setup.data as GradingSetup | null;
  const loaded = Boolean(query.data);
  const refetchRecord = query.refetch;
  useEffect(() => {
    if (
      loaded &&
      recordVersion !== undefined &&
      recordVersion !== assessment?.version
    )
      refetchRecord();
  }, [loaded, refetchRecord, recordVersion, assessment?.version]);
  async function start() {
    if (!currentSetup) return;
    setBusy(true);
    try {
      const result = await api.grades.record({
        learner,
        item,
        evidence,
        revision: currentSetup.revision,
      });
      if ("error" in result) {
        if (isClientErrorCode(result.error)) {
          toast.error(
            "The assessment start could not be confirmed. Grading data was refreshed before retrying.",
          );
          query.refetch();
          setup.refetch();
          onSaved();
        } else if (result.error === "CONFLICT") {
          toast.error(
            "The grading setup changed before this assessment started. The latest setup is loading; review it and retry.",
          );
          query.refetch();
          setup.refetch();
          onSaved();
        } else
          toast.error(
            result.error === "INVALID_REQUEST"
              ? "Save at least one valid grading criterion before starting this assessment."
              : publicErrorMessage(result.error),
          );
      } else {
        query.refetch();
        onSaved();
      }
    } catch {
      toast.error(
        "The assessment start could not be confirmed. Grading data was refreshed before retrying.",
      );
      query.refetch();
      setup.refetch();
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  if ((query.loading && !query.data) || (setup.loading && !setup.data))
    return <LoadingState label="Loading assessment…" />;
  if ((query.error && !query.data) || (setup.error && !setup.data))
    return (
      <ErrorState
        message={query.error ?? setup.error ?? "Could not load grading setup."}
        refused={!query.data ? query.refused : setup.refused}
        onRetry={() => {
          void Promise.all([query.refetch(), setup.refetch()]);
        }}
      />
    );
  if (!query.data || !setup.data)
    return <LoadingState label="Loading assessment…" />;
  const unavailable =
    disabled ||
    query.loading ||
    setup.loading ||
    Boolean(query.error || setup.error);
  return (
    <div className={className}>
      {!disabled ? (
        <GradingDataNotice
          loading={query.loading || setup.loading}
          error={query.error ?? setup.error}
          onRetry={() => {
            query.refetch();
            setup.refetch();
          }}
        />
      ) : null}
      <Facts className="mb-3 text-sm">
        <span className="font-medium">{learnerLabel ?? "Learner"}</span>
        <Fact.Where>{itemLabel ?? "Assignment"}</Fact.Where>
      </Facts>
      {assessment ? (
        <AssessmentEditor
          key={`${assessment.grade}-${assessment.version}`}
          assessment={assessment}
          disabled={unavailable}
          onDirtyChange={onDirtyChange}
          onSaved={() => {
            query.refetch();
            onSaved();
          }}
        />
      ) : (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {evidence
              ? "Start an assessment of the selected attempt. Its grading criteria are fixed when you start."
              : "No attempt selected. You can record an assignment excusal; assessing work requires selecting a submitted attempt."}
          </p>
          <Button disabled={busy || unavailable} onClick={start}>
            {evidence ? "Start assessment" : "Record assignment excusal"}
          </Button>
        </div>
      )}
    </div>
  );
}
export const GradeInput = AssessmentInput;

function AssessmentEditor({
  assessment: a,
  onSaved,
  disabled,
  onDirtyChange,
}: {
  assessment: Assessment;
  onSaved: () => void;
  disabled: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [feedback, setFeedback] = useState(a.feedback);
  const [judgments, setJudgments] = useState<CompetencyJudgment[]>(() =>
    competencyJudgments(a.judgments),
  );
  const [pointValues, setPointValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pointJudgments(a.judgments).map((judgment) => [
        judgment.criterion,
        String(judgment.score),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<"release" | "excuse" | null>(null);
  const points = pointCriteria(a.criteria);
  const rubrics = competencyCriteria(a.criteria);
  const pointValuesValid = points.every((criterion) => {
    const value = pointValues[criterion.criterion] ?? "";
    if (!value.trim()) return true;
    const score = Number(value);
    return Number.isFinite(score) && score >= 0 && score <= criterion.maxPoints;
  });
  const currentJudgments =
    a.method === "POINTS"
      ? points.flatMap((criterion) => {
          const value = pointValues[criterion.criterion] ?? "";
          return value.trim()
            ? [
                {
                  kind: "POINTS" as const,
                  criterion: criterion.criterion,
                  score: Number(value),
                },
              ]
            : [];
        })
      : judgments;
  const dirty =
    feedback !== a.feedback ||
    JSON.stringify(currentJudgments) !== JSON.stringify(a.judgments);
  const complete =
    Boolean(a.evidence) &&
    a.criteria.length > 0 &&
    pointValuesValid &&
    (a.method === "POINTS"
      ? points.every(
          (criterion) => (pointValues[criterion.criterion] ?? "").trim() !== "",
        )
      : rubrics.every((criterion) =>
          judgments.some(
            (judgment) => judgment.criterion === criterion.criterion,
          ),
        ));
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function update(
    criterion: string,
    field: "rating" | "feedback",
    value: string,
  ) {
    setJudgments((old) => {
      const entry = old.find((j) => j.criterion === criterion) ?? {
        kind: "COMPETENCY" as const,
        criterion,
        rating: "NOT_ASSESSED" as const,
        feedback: "",
      };
      const updated: CompetencyJudgment =
        field === "rating"
          ? { ...entry, rating: value as Rating }
          : { ...entry, feedback: value };
      return [...old.filter((j) => j.criterion !== criterion), updated];
    });
  }
  async function action(
    kind: "save" | "release" | "retract" | "restore-excused" | "excuse",
  ) {
    setBusy(true);
    try {
      const result =
        kind === "save"
          ? await api.grades.save({
              grade: a.grade,
              version: a.version,
              feedback,
              judgments: currentJudgments,
            })
          : kind === "excuse"
            ? await api.grades.excuse({
                grade: a.grade,
                version: a.version,
                feedback,
              })
            : await api.grades[kind]({ grade: a.grade, version: a.version });
      if ("error" in result) {
        if (isClientErrorCode(result.error)) {
          toast.error(
            "The update outcome could not be confirmed. Grading data was refreshed before retrying.",
          );
          onSaved();
        } else
          toast.error(
            result.error === "CONFLICT"
              ? "This assessment changed, is locked, or is incomplete. Reload and check every criterion before releasing."
              : result.error === "INVALID_REQUEST"
                ? "Complete each criterion with a valid score or competency level."
                : publicErrorMessage(result.error),
          );
      } else {
        toast.success(
          kind === "release"
            ? "Assessment released"
            : kind === "save"
              ? "Draft saved"
              : "Assessment updated",
        );
        onSaved();
      }
    } catch {
      toast.error(
        "The update outcome could not be confirmed. Grading data was refreshed before retrying.",
      );
      onSaved();
    } finally {
      setBusy(false);
    }
  }
  if (a.status !== "DRAFT")
    return (
      <div className="space-y-3">
        <AssessmentCard assessment={a} staff />
        <Button
          disabled={busy || disabled}
          variant="outline"
          onClick={() =>
            action(a.status === "EXCUSED" ? "restore-excused" : "retract")
          }
        >
          {a.status === "EXCUSED" ? "Revoke excusal" : "Retract to correct"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Retraction hides this assessment from the learner until it is released
          again. Earlier releases remain in correction history.
        </p>
      </div>
    );
  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <Facts className="text-sm">
        <Fact.Status status="DRAFT" />
        <span className="text-muted-foreground">Visible only to staff</span>
        <span>{a.attempt ? `Attempt ${a.attempt}` : "Assignment excusal"}</span>
      </Facts>
      {a.evidence && a.criteria.length === 0 && (
        <p role="alert" className="text-sm">
          No criteria were saved when this assessment started. Update the
          assignment setup before starting another assessment.
        </p>
      )}
      {a.evidence && a.method === "POINTS" && (
        <div className="space-y-3">
          {points.map((criterion) => {
            const value = pointValues[criterion.criterion] ?? "";
            const numeric = Number(value);
            const valid =
              !value.trim() ||
              (Number.isFinite(numeric) &&
                numeric >= 0 &&
                numeric <= criterion.maxPoints);
            return (
              <div
                key={criterion.criterion}
                className="grid gap-2 border-t border-border pt-3 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end"
              >
                <div>
                  <p className="font-medium">{criterion.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Up to {criterion.maxPoints} points
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`${a.grade}-${criterion.criterion}-score`}>
                    Score / {criterion.maxPoints}
                  </Label>
                  <Input
                    id={`${a.grade}-${criterion.criterion}-score`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={criterion.maxPoints}
                    step="any"
                    value={value}
                    disabled={busy || disabled}
                    aria-invalid={!valid}
                    onChange={(event) =>
                      setPointValues((current) => ({
                        ...current,
                        [criterion.criterion]: event.target.value,
                      }))
                    }
                    placeholder="Not scored"
                  />
                  {!valid && (
                    <p className="text-xs text-destructive">
                      Enter 0 through {criterion.maxPoints}.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex items-baseline justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
            <span className="font-medium">Total</span>
            <span className="font-semibold tabular-nums">
              {pointValuesValid
                ? sumDecimals(
                    currentJudgments.map((judgment) =>
                      judgment.kind === "POINTS" ? judgment.score : 0,
                    ),
                  )
                : "—"}{" "}
              / {a.outOf}
            </span>
          </div>
        </div>
      )}
      {a.evidence &&
        a.method === "COMPETENCY" &&
        rubrics.map((c) => {
          const j = judgments.find((j) => j.criterion === c.criterion);
          return (
            <fieldset
              key={c.criterion}
              className="space-y-3 border-t border-border pt-3"
            >
              <legend className="font-medium">{c.name}</legend>
              <RubricDescription rubric={c} />
              <Label htmlFor={`${a.grade}-${c.criterion}-rating`}>
                Assessment
              </Label>
              <Select
                value={j?.rating ?? ""}
                disabled={busy || disabled}
                onValueChange={(value) => update(c.criterion, "rating", value)}
              >
                <SelectTrigger
                  id={`${a.grade}-${c.criterion}-rating`}
                  className="w-full"
                >
                  <SelectValue placeholder="Choose a level…" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {levelLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {j?.rating && levelDescription(c, j.rating).trim() && (
                <p className="text-sm text-muted-foreground">
                  {levelDescription(c, j.rating)}
                </p>
              )}
              <details open={j?.feedback ? true : undefined}>
                <summary className="cursor-pointer text-sm text-muted-foreground">
                  Skill feedback (optional)
                </summary>
                <div className="mt-2 space-y-2">
                  <Label htmlFor={`${a.grade}-${c.criterion}-feedback`}>
                    Feedback on {c.name}
                  </Label>
                  <Textarea
                    id={`${a.grade}-${c.criterion}-feedback`}
                    maxLength={20000}
                    disabled={busy || disabled}
                    value={j?.feedback ?? ""}
                    onChange={(e) =>
                      update(c.criterion, "feedback", e.target.value)
                    }
                  />
                </div>
              </details>
            </fieldset>
          );
        })}
      <Label htmlFor={`feedback-${a.grade}`}>
        {a.evidence ? "Overall feedback (optional)" : "Excusal explanation"}
      </Label>
      <Textarea
        id={`feedback-${a.grade}`}
        maxLength={20000}
        disabled={busy || disabled}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {a.evidence && (
          <>
            <Button
              disabled={
                busy ||
                disabled ||
                !dirty ||
                (a.method === "POINTS" && !pointValuesValid)
              }
              onClick={() => action("save")}
            >
              Save draft
            </Button>
            <Button
              variant="outline"
              disabled={busy || disabled || dirty || !complete}
              onClick={() =>
                setPreview(preview === "release" ? null : "release")
              }
            >
              Review release
            </Button>
          </>
        )}
        <Button
          variant="outline"
          disabled={busy || disabled}
          onClick={() => setPreview(preview === "excuse" ? null : "excuse")}
        >
          Excuse {a.evidence ? "this assessment" : "assignment"}
        </Button>
      </div>
      {dirty && a.evidence && (
        <p className="text-xs text-muted-foreground">
          Save your changes before reviewing the release.
        </p>
      )}
      {preview && (preview === "excuse" || !dirty) && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="font-medium">
            {preview === "excuse"
              ? "The learner will see this excusal and explanation."
              : "The learner will see this assessment and feedback."}
          </p>
          <AssessmentCard
            assessment={{
              ...a,
              status: preview === "excuse" ? "EXCUSED" : "RELEASED",
              feedback: preview === "excuse" ? feedback : a.feedback,
              judgments: preview === "excuse" ? [] : currentJudgments,
              score:
                a.method === "POINTS" && preview !== "excuse"
                  ? sumDecimals(
                      currentJudgments.map((judgment) =>
                        judgment.kind === "POINTS" ? judgment.score : 0,
                      ),
                    )
                  : 0,
              scored: preview !== "excuse" && complete,
            }}
            staff
            preview
          />
          <Button disabled={busy || disabled} onClick={() => action(preview)}>
            {preview === "excuse"
              ? "Confirm excusal to learner"
              : "Confirm release to learner"}
          </Button>
        </div>
      )}
    </div>
  );
}

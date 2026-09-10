"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Fact, Facts } from "@/components/facts";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
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
import { api, publicErrorMessage, unwrap } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  type Assessment,
  AssessmentCard,
  LEVELS,
  levelDescription,
  levelLabel,
  RubricDescription,
} from "./assessment-history";

interface Props {
  learner: string;
  item: string;
  evidence?: string;
  learnerLabel?: string;
  itemLabel?: string;
  onSaved: () => void;
  className?: string;
}
export function GradeInput({
  learner,
  item,
  evidence = "",
  learnerLabel,
  itemLabel,
  onSaved,
  className,
}: Props) {
  const { session } = useAuth();
  const query = useQuery(
    session ? async () => unwrap(await api.grades["for-item"]({ item })) : null,
    [session, learner, item, evidence],
  );
  const [busy, setBusy] = useState(false);
  const assessment = query.data?.grades.find(
    (a) => a.learner === learner && a.evidence === evidence,
  );
  async function start() {
    setBusy(true);
    try {
      const result = await api.grades.record({ learner, item, evidence });
      if ("error" in result)
        toast.error(
          result.error === "INVALID_REQUEST"
            ? "Select rubrics first and use a valid level or Not assessed for each skill."
            : publicErrorMessage(result.error),
        );
      else query.refetch();
    } finally {
      setBusy(false);
    }
  }
  if (query.loading && !query.data)
    return <LoadingState label="Loading assessment…" />;
  if (query.error)
    return <ErrorState message={query.error} onRetry={query.refetch} />;
  return (
    <div className={className}>
      <Facts className="mb-3 text-sm">
        <span className="font-medium">{learnerLabel ?? "Learner"}</span>
        <Fact.Where>{itemLabel ?? "Assignment"}</Fact.Where>
      </Facts>
      {assessment ? (
        <AssessmentEditor
          key={`${assessment.grade}-${assessment.version}`}
          assessment={assessment}
          onSaved={() => {
            query.refetch();
            onSaved();
          }}
        />
      ) : (
        <div className="space-y-3 rounded-md border border-border p-4">
          <p className="text-sm text-muted-foreground">
            {evidence
              ? "Start an assessment of the selected attempt. Its rubric editions are fixed when you start."
              : "No attempt selected. You can record an assignment excusal; assessing work requires selecting a submitted attempt."}
          </p>
          <Button disabled={busy} onClick={start}>
            {evidence ? "Start assessment" : "Record assignment excusal"}
          </Button>
        </div>
      )}
    </div>
  );
}
function AssessmentEditor({
  assessment: a,
  onSaved,
}: {
  assessment: Assessment;
  onSaved: () => void;
}) {
  const [feedback, setFeedback] = useState(a.feedback);
  const [judgments, setJudgments] = useState(a.judgments);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<"release" | "excuse" | null>(null);
  const dirty =
    feedback !== a.feedback ||
    JSON.stringify(judgments) !== JSON.stringify(a.judgments);
  const complete =
    Boolean(a.evidence) &&
    a.criteria.length > 0 &&
    a.criteria.every((c) => judgments.some((j) => j.criterion === c.criterion));
  function update(
    criterion: string,
    field: "rating" | "feedback",
    value: string,
  ) {
    setJudgments((old) => {
      const entry = old.find((j) => j.criterion === criterion) ?? {
        criterion,
        rating: "",
        feedback: "",
      };
      return [
        ...old.filter((j) => j.criterion !== criterion),
        { ...entry, [field]: value },
      ];
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
              judgments: judgments.filter((j) => j.rating !== ""),
            })
          : kind === "excuse"
            ? await api.grades.excuse({
                grade: a.grade,
                version: a.version,
                feedback,
              })
            : await api.grades[kind]({ grade: a.grade, version: a.version });
      if ("error" in result) {
        toast.error(
          result.error === "CONFLICT"
            ? "This assessment changed, is locked, or is incomplete. Reload and check every skill before releasing."
            : result.error === "INVALID_REQUEST"
              ? "Select rubrics first and use a valid level or Not assessed for each skill."
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
      toast.error("Could not save. Reload before retrying.");
    } finally {
      setBusy(false);
    }
  }
  if (a.status !== "DRAFT")
    return (
      <div className="space-y-3">
        <AssessmentCard assessment={a} staff />
        <Button
          disabled={busy}
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
          No criteria were selected when this assessment started. Configure
          rubrics before starting an assessment of another attempt.
        </p>
      )}
      {a.evidence &&
        a.criteria.map((c) => {
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
                disabled={busy}
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
                    disabled={busy}
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
        disabled={busy}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {a.evidence && (
          <>
            <Button disabled={busy || !dirty} onClick={() => action("save")}>
              Save draft
            </Button>
            <Button
              variant="outline"
              disabled={busy || dirty || !complete}
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
          disabled={busy}
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
            }}
            staff
            preview
          />
          <Button disabled={busy} onClick={() => action(preview)}>
            {preview === "excuse"
              ? "Confirm excusal to learner"
              : "Confirm release to learner"}
          </Button>
        </div>
      )}
    </div>
  );
}

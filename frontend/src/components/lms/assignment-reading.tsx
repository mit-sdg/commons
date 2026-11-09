import { Clock } from "lucide-react";
import { Fact } from "@/components/facts";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Criterion } from "@/lib/grading";
import { competencyCriteria, pointCriteria } from "@/lib/grading";
import { RubricDescription } from "./assessment-history";
export function AssignmentInstructions({
  instructions,
}: {
  instructions: string;
}) {
  return (
    <Card density="compact">
      <CardHeader>
        <CardTitle className="text-base">Instructions</CardTitle>
      </CardHeader>
      <CardContent>
        <TaskMarkdown content={instructions} />
      </CardContent>
    </Card>
  );
}
export function AssignmentDates({
  availableAt,
  dueAt,
  closeAt,
  overdue = false,
}: {
  availableAt: string;
  dueAt: string;
  closeAt: string | null;
  overdue?: boolean;
}) {
  return (
    <Card density="compact">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="size-4" /> Dates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">Available</p>
          <Fact.Due at={availableAt} />
        </div>
        <div>
          <p className="text-muted-foreground">Due</p>
          <Fact.Due
            at={dueAt}
            className={overdue ? "text-destructive" : undefined}
          />
        </div>
        {closeAt && (
          <div>
            <p className="text-muted-foreground">Closes</p>
            <Fact.Due at={closeAt} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
export function AssignmentSkills({ criteria }: { criteria: Criterion[] }) {
  if (!criteria.length) return null;
  const points = pointCriteria(criteria);
  const rubrics = competencyCriteria(criteria);
  const usesPoints = points.length > 0;
  return (
    <details className="rounded-lg border p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        {usesPoints ? "Grading criteria" : "Assessment criteria"}{" "}
        <span className="ml-2 text-muted-foreground font-normal">
          {criteria.length}{" "}
          {usesPoints
            ? criteria.length === 1
              ? "criterion"
              : "criteria"
            : criteria.length === 1
              ? "skill"
              : "skills"}
        </span>
      </summary>
      <div className="mt-2 divide-y">
        {usesPoints
          ? points.map((criterion) => (
              <div
                key={criterion.criterion}
                className="flex items-center justify-between gap-3 p-3"
              >
                <h3 className="text-sm font-medium">{criterion.name}</h3>
                <span className="tabular-nums text-muted-foreground">
                  {criterion.maxPoints} points
                </span>
              </div>
            ))
          : rubrics.map((criterion) => (
              <div key={criterion.criterion} className="space-y-2 p-3">
                <h3 className="text-sm font-medium">{criterion.name}</h3>
                <RubricDescription rubric={criterion} showEdition={false} />
              </div>
            ))}
      </div>
    </details>
  );
}

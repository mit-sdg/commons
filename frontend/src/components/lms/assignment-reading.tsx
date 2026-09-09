import { Clock } from "lucide-react";
import { Fact } from "@/components/facts";
import { TaskMarkdown } from "@/components/tasks/task-markdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Output } from "@/lib/api";
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
export function AssignmentSkills({
  criteria,
}: {
  criteria: Extract<Output<"/grades/item">, { criteria: unknown }>["criteria"];
}) {
  if (!criteria.length) return null;
  return (
    <details className="rounded-lg border p-4 text-sm">
      <summary className="cursor-pointer font-medium">
        Assessment criteria{" "}
        <span className="ml-2 text-muted-foreground font-normal">
          {criteria.length} {criteria.length === 1 ? "skill" : "skills"}
        </span>
      </summary>
      <div className="mt-2 divide-y">
        {criteria.map((c) => (
          <div key={c.criterion} className="space-y-2 p-3">
            <h3 className="text-sm font-medium">{c.name}</h3>
            <RubricDescription rubric={c} showEdition={false} />
          </div>
        ))}
      </div>
    </details>
  );
}

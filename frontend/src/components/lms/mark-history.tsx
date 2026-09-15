import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export interface Mark {
  mark: string;
  learner: string;
  item: string;
  evidence: string;
  score: number;
  scored: boolean;
  outOf: number;
  status: string;
  feedback: string;
  attempt: number | null;
  releasedAt: string | null;
  updatedAt: string;
  version: number;
  label?: string | null;
}

export function MarkCard({
  mark,
  staff = false,
}: {
  mark: Mark;
  staff?: boolean;
}) {
  return (
    <Card density="compact" id={`mark-${mark.mark}`}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Facts as="div">
            <CardTitle className="text-base">
              <Link
                className="hover:underline"
                href={`${staff ? "/staff" : ""}/assignments/${mark.item}`}
              >
                {mark.label || "Assignment"}
              </Link>
            </CardTitle>
            {mark.attempt ? (
              <Link
                className="text-xs text-muted-foreground hover:underline"
                href={`${staff ? "/staff" : ""}/assignments/${mark.item}${mark.evidence ? `#attempt-${mark.evidence}` : ""}`}
              >
                Attempt {mark.attempt}
              </Link>
            ) : null}
          </Facts>
          <Fact.Status status={mark.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {mark.status === "EXCUSED" ? (
          <p className="text-sm">Excused. No numeric grade was recorded.</p>
        ) : !mark.scored ? (
          <p className="text-sm text-muted-foreground">
            Ungraded. No score has been entered.
          </p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums">
            {mark.score}{" "}
            <span className="text-base font-normal">/ {mark.outOf}</span>
          </p>
        )}
        <Facts className="text-xs text-muted-foreground">
          {mark.releasedAt ? (
            <Fact.When verb="Released" at={mark.releasedAt} />
          ) : null}
          {staff && mark.status === "DRAFT" ? (
            <span>Visible only to staff</span>
          ) : null}
        </Facts>
        {mark.feedback ? (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Feedback
            </p>
            <p className="whitespace-pre-wrap text-sm">{mark.feedback}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function MarkHistory({
  marks,
  staff = false,
}: {
  marks: Mark[];
  staff?: boolean;
}) {
  if (marks.length === 0)
    return (
      <p className="text-sm text-muted-foreground">No point grades yet.</p>
    );
  return (
    <div className="space-y-3">
      {[...marks]
        .sort((left, right) =>
          `${right.updatedAt}-${right.mark}`.localeCompare(
            `${left.updatedAt}-${left.mark}`,
          ),
        )
        .map((mark) => (
          <MarkCard key={mark.mark} mark={mark} staff={staff} />
        ))}
    </div>
  );
}

import { Users } from "lucide-react";
import { Fact, Facts } from "@/components/facts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Assessment } from "@/lib/grading";
import type { Team } from "@/lib/teams";

/**
 * Who a student shares a team assignment with, and where the team's work
 * stands: nothing handed in, handed in by whom and when, or the released grade.
 */
export function TeamCard({
  team,
  name,
  me,
  latest,
  grade,
  overdue,
}: {
  team: Team | null;
  name: string | null;
  me: string;
  latest: { authorName: string | null; submittedAt: string } | null;
  grade: Pick<
    Assessment,
    "status" | "method" | "scored" | "score" | "outOf"
  > | null;
  overdue: boolean;
}) {
  return (
    <Card density="compact">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="size-4" /> Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {team ? (
          <>
            {name && <p className="font-medium">{name}</p>}
            <ul className="flex flex-wrap gap-1.5">
              {team.members.map((member) => (
                <li
                  key={String(member.user)}
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[0.8125rem]"
                >
                  {member.displayName ?? "Unnamed student"}
                  {String(member.user) === me && (
                    <span className="ml-1 text-muted-foreground">you</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">
            You are on no team, so you submit on your own.
          </p>
        )}
        <Facts className="text-xs">
          {grade ? (
            <>
              <Fact.Status status={grade.status} />
              {grade.status === "RELEASED" &&
                grade.method === "POINTS" &&
                grade.scored && (
                  <span>
                    <span className="text-muted-foreground">Grade</span>{" "}
                    <span className="font-medium tabular-nums">
                      {grade.score} / {grade.outOf}
                    </span>
                  </span>
                )}
            </>
          ) : latest ? (
            <>
              <Fact.Status status="SUBMITTED" />
              {team && latest.authorName && <span>{latest.authorName}</span>}
              <Fact.When form="absolute" at={latest.submittedAt} />
            </>
          ) : (
            <Fact.Status status={overdue ? "OVERDUE" : "PENDING"} />
          )}
        </Facts>
      </CardContent>
    </Card>
  );
}

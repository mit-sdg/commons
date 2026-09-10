"use client";

import { ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { Fact, Facts } from "@/components/facts";
import { StatusBadge } from "@/components/lms/status-badge";
import { EmptyState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Output } from "@/lib/api";

export type Assessment = Extract<
  Output<"/grades/for-me">,
  { grades: unknown }
>["grades"][number];
export type Rubric = Assessment["criteria"][number];
export const LEVELS = [
  "DEFICIENT",
  "EMERGENT",
  "COMPETENT",
  "EXPERT",
  "NOT_ASSESSED",
] as const;
export function levelLabel(level: string) {
  return (
    (
      {
        DEFICIENT: "Deficient",
        EMERGENT: "Emergent",
        COMPETENT: "Competent",
        EXPERT: "Expert",
        NOT_ASSESSED: "Not assessed",
      } as Record<string, string>
    )[level] ?? "Not assessed"
  );
}
export function levelDescription(
  rubric: Pick<Rubric, "deficient" | "emergent" | "competent" | "expert">,
  level: string,
) {
  return (
    (
      {
        DEFICIENT: rubric.deficient,
        EMERGENT: rubric.emergent,
        COMPETENT: rubric.competent,
        EXPERT: rubric.expert,
      } as Record<string, string>
    )[level] ?? ""
  );
}
export function RubricDescription({
  rubric,
  showEdition = true,
  title,
  action,
}: {
  showEdition?: boolean;
  title?: string;
  action?: ReactNode;
  rubric: Pick<
    Rubric,
    | "name"
    | "number"
    | "description"
    | "deficient"
    | "emergent"
    | "competent"
    | "expert"
    | "referenceUrl"
  >;
}) {
  const levels = LEVELS.filter((l) => levelDescription(rubric, l).trim());
  const reference = /^https?:\/\//i.test(rubric.referenceUrl)
    ? rubric.referenceUrl
    : null;
  const hasText = rubric.description.trim() || levels.length > 0;
  const body = (
    <div className="mt-3 space-y-3 text-sm">
      {rubric.description.trim() && (
        <p className="whitespace-pre-wrap">{rubric.description}</p>
      )}
      <dl className="space-y-2">
        {levels.map((l) => (
          <div key={l}>
            <dt className="font-medium">{levelLabel(l)}</dt>
            <dd className="text-muted-foreground whitespace-pre-wrap">
              {levelDescription(rubric, l)}
            </dd>
          </div>
        ))}
      </dl>
      {showEdition && (
        <p className="text-xs text-muted-foreground">Edition {rubric.number}</p>
      )}
    </div>
  );
  const external = reference && (
    <a
      className="shrink-0 text-sm text-muted-foreground underline underline-offset-4"
      href={reference}
      target="_blank"
      rel="noopener noreferrer"
    >
      Full rubric ↗
    </a>
  );
  if (title)
    return (
      <div className="flex flex-wrap items-start gap-3">
        {hasText ? (
          <details className="group min-w-0 flex-1">
            <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-sm font-medium [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
              {title}
            </summary>
            {body}
          </details>
        ) : (
          <span className="min-w-0 flex-1 py-1 text-sm font-medium">
            {title}
          </span>
        )}
        <div className="flex items-center gap-3">
          {external}
          {action}
        </div>
      </div>
    );
  if (!hasText && !reference) return null;
  return (
    <div className="space-y-2 text-sm">
      {external}
      {hasText && (
        <details>
          <summary className="cursor-pointer text-muted-foreground">
            Details
          </summary>
          {body}
        </details>
      )}
    </div>
  );
}

export function AssessmentCard({
  assessment: a,
  staff = false,
  skill,
  preview = false,
}: {
  assessment: Assessment;
  staff?: boolean;
  skill?: string;
  preview?: boolean;
}) {
  const criteria = a.criteria.filter((c) => !skill || c.standard === skill);
  return (
    <Card density="compact" id={`assessment-${a.grade}`}>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Facts as="div">
            <CardTitle className="text-sm">
              <Link
                className="hover:underline"
                href={`${staff ? "/staff" : ""}/assignments/${a.item}`}
              >
                {a.label ?? "Assignment"}
              </Link>
            </CardTitle>
            {a.attempt && (
              <Link
                className="text-xs text-muted-foreground hover:underline"
                href={`${staff ? "/staff" : ""}/assignments/${a.item}${a.evidence ? `#attempt-${a.evidence}` : ""}`}
              >
                Attempt {a.attempt}
              </Link>
            )}
          </Facts>
          <Facts as="div" className="text-xs">
            {skill && a.status !== "EXCUSED" && (
              <span className="rounded-md bg-muted px-2 py-1 font-medium">
                {a.judgments.find((j) => j.criterion === criteria[0]?.criterion)
                  ? levelLabel(
                      a.judgments.find(
                        (j) => j.criterion === criteria[0]?.criterion,
                      )!.rating,
                    )
                  : "Awaiting assessment"}
              </span>
            )}
            {(staff || a.status !== "RELEASED") && (
              <StatusBadge status={a.status} />
            )}
            {!staff && a.status === "RELEASED" && a.history.length > 1 && (
              <span className="rounded-md bg-muted px-2 py-1">Corrected</span>
            )}
          </Facts>
        </div>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {preview ? (
              "Release preview"
            ) : a.releasedAt ? (
              <Fact.When verb="Released" at={a.releasedAt} />
            ) : (
              "Draft, visible only to staff"
            )}
          </summary>
          <Facts as="div" className="mt-2">
            <Fact.When verb="Submitted" at={a.submittedAt} form="absolute" />
            <Fact.When verb="Released" at={a.releasedAt} form="absolute" />
          </Facts>
          {criteria.map((c) => (
            <div key={c.criterion} className="mt-3 space-y-2">
              <p>
                Rubric used{skill ? "" : `: ${c.name}`}, edition {c.number}
              </p>
              <RubricDescription rubric={c} showEdition={false} />
            </div>
          ))}
        </details>
      </CardHeader>
      <CardContent>
        {a.status === "EXCUSED" ? (
          <p className="text-sm">Excused. No competency judgment was made.</p>
        ) : (
          criteria.map((c) => {
            const j = a.judgments.find((j) => j.criterion === c.criterion);
            const description = j ? levelDescription(c, j.rating).trim() : "";
            const feedback = j?.feedback.trim() ?? "";
            const row = (
              <>
                <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {j ? levelLabel(j.rating) : "Awaiting assessment"}
                </span>
              </>
            );
            return description || feedback ? (
              <details
                key={c.criterion}
                className="group border-t border-border"
              >
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
                  {skill ? <span>Details</span> : row}
                </summary>
                <div className="space-y-2 pb-3 pl-5 text-sm">
                  {description && (
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {description}
                    </p>
                  )}
                  {feedback && (
                    <p className="whitespace-pre-wrap">{feedback}</p>
                  )}
                </div>
              </details>
            ) : skill ? null : (
              <div
                key={c.criterion}
                className="flex items-center gap-2 border-t border-border py-2 pl-5 text-sm"
              >
                {row}
              </div>
            );
          })
        )}
        {a.feedback.trim() && (
          <details className="border-t border-border pt-2 text-sm">
            <summary className="cursor-pointer font-medium">
              Overall feedback
            </summary>
            <p className="mt-2 whitespace-pre-wrap">{a.feedback}</p>
          </details>
        )}
        {a.history.length > (a.status === "DRAFT" || preview ? 0 : 1) && (
          <details className="border-t border-border pt-3 text-sm">
            <summary className="cursor-pointer">Correction history</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Earlier versions of this assessment, not additional assessed work.
            </p>
            {a.history
              .slice(0, a.status === "DRAFT" || preview ? undefined : -1)
              .map((h) => (
                <div
                  key={h.revision}
                  className="mt-3 space-y-2 rounded-md border border-border p-3"
                >
                  <Facts as="div" className="text-xs text-muted-foreground">
                    <Fact.When
                      verb="Earlier release"
                      at={h.releasedAt}
                      form="absolute"
                    />
                    <span>
                      {h.status === "EXCUSED"
                        ? "Excused"
                        : "Superseded assessment"}
                    </span>
                  </Facts>
                  {h.judgments
                    .filter((j) =>
                      criteria.some((c) => c.criterion === j.criterion),
                    )
                    .map((j) => (
                      <div key={j.criterion}>
                        <p>
                          {
                            criteria.find((c) => c.criterion === j.criterion)
                              ?.name
                          }
                          : {levelLabel(j.rating)}
                        </p>
                        {j.feedback && (
                          <p className="whitespace-pre-wrap text-muted-foreground">
                            {j.feedback}
                          </p>
                        )}
                      </div>
                    ))}
                  {h.feedback && (
                    <p className="whitespace-pre-wrap">{h.feedback}</p>
                  )}
                </div>
              ))}
          </details>
        )}
      </CardContent>
    </Card>
  );
}
export function AssessmentHistory({
  assessments,
  staff = false,
  toggle = true,
}: {
  assessments: Assessment[];
  staff?: boolean;
  toggle?: boolean;
}) {
  const [view, setView] = useState("assignment");
  const sorted = [...assessments].sort(
    (a, b) =>
      Date.parse(a.submittedAt ?? a.createdAt) -
        Date.parse(b.submittedAt ?? b.createdAt) ||
      a.grade.localeCompare(b.grade),
  );
  const skills = new Map<string, Rubric>();
  for (const a of sorted) for (const c of a.criteria) skills.set(c.standard, c);
  return (
    <div className="space-y-5">
      {toggle && (
        <div className="flex gap-2" aria-label="Assessment grouping">
          <Button
            variant={view === "assignment" ? "default" : "outline"}
            aria-pressed={view === "assignment"}
            onClick={() => setView("assignment")}
          >
            By assignment
          </Button>
          <Button
            variant={view === "skill" ? "default" : "outline"}
            aria-pressed={view === "skill"}
            onClick={() => setView("skill")}
          >
            By skill
          </Button>
        </div>
      )}
      {sorted.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No assessments yet"
          description="Released feedback on your work appears here."
        />
      ) : view === "assignment" || !toggle ? (
        <div className="space-y-4">
          {sorted.map((a) => (
            <AssessmentCard key={a.grade} assessment={a} staff={staff} />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {[...skills].map(([id, rubric]) => (
            <section className="space-y-4" key={id}>
              <div>
                <h2 className="text-lg font-semibold">{rubric.name}</h2>
              </div>
              {sorted
                .filter((a) => a.criteria.some((c) => c.standard === id))
                .map((a) => (
                  <AssessmentCard
                    key={a.grade}
                    assessment={a}
                    staff={staff}
                    skill={id}
                  />
                ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

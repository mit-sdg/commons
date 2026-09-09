"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBadge } from "@/components/lms/status-badge";
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
    )[level] ?? "This skill was not assessed on this work."
  );
}
function when(at: string | null) {
  return at
    ? new Date(at).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not released";
}
export function RubricDescription({
  rubric,
}: {
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
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">
        View rubric · edition {rubric.number}
      </summary>
      <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
        <p className="whitespace-pre-wrap">{rubric.description}</p>
        <dl className="space-y-3">
          {LEVELS.filter((l) => l !== "NOT_ASSESSED").map((l) => (
            <div key={l}>
              <dt className="font-medium">{levelLabel(l)}</dt>
              <dd className="text-muted-foreground whitespace-pre-wrap">
                {levelDescription(rubric, l)}
              </dd>
            </div>
          ))}
        </dl>
        {/^https?:\/\//i.test(rubric.referenceUrl) && (
          <a
            className="underline underline-offset-4"
            href={rubric.referenceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Further guidance (external page)
          </a>
        )}
      </div>
    </details>
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
    <Card id={`assessment-${a.grade}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              <Link
                className="hover:underline"
                href={`${staff ? "/staff" : ""}/assignments/${a.item}${a.evidence ? `#attempt-${a.evidence}` : ""}`}
              >
                {a.label ?? "Assignment"}
              </Link>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {a.attempt ? `Attempt ${a.attempt}` : "Assignment excusal"}
            </p>
          </div>
          <StatusBadge status={a.status} />
        </div>
        <p className="text-xs text-muted-foreground">
          {a.submittedAt && <>Submitted {when(a.submittedAt)} · </>}
          {preview
            ? "Release preview"
            : a.releasedAt
              ? `Released ${when(a.releasedAt)}`
              : "Draft — visible only to staff"}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {a.status === "EXCUSED" ? (
          <p className="text-sm">Excused. No competency judgment was made.</p>
        ) : (
          criteria.map((c) => {
            const j = a.judgments.find((j) => j.criterion === c.criterion);
            return (
              <section
                key={c.criterion}
                className="space-y-2 border-t border-border pt-3"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-medium">{c.name}</h3>
                  <span className="rounded-md bg-muted px-2 py-1 text-sm font-medium">
                    {j ? levelLabel(j.rating) : "Awaiting assessment"}
                  </span>
                </div>
                {j && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {levelDescription(c, j.rating)}
                  </p>
                )}
                {j?.feedback && (
                  <p className="text-sm whitespace-pre-wrap">{j.feedback}</p>
                )}
                <RubricDescription rubric={c} />
              </section>
            );
          })
        )}
        {a.feedback && (
          <div className="border-t border-border pt-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Overall feedback
            </p>
            <p className="text-sm whitespace-pre-wrap">{a.feedback}</p>
          </div>
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
                  <p className="text-xs text-muted-foreground">
                    Earlier release {when(h.releasedAt)} ·{" "}
                    {h.status === "EXCUSED"
                      ? "Excused"
                      : "Superseded assessment"}
                  </p>
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
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No assessments yet. Released feedback will appear here.
        </p>
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
                <p className="text-sm text-muted-foreground">
                  Each entry describes this skill on a particular piece of work.
                </p>
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

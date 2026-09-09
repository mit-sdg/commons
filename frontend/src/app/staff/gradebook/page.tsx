"use client";
import Link from "next/link";
import { useState } from "react";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { StandardManager } from "@/components/lms/grade-setup";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadGradebook } from "@/lib/lms";
export default function GradebookPage() {
  const { session, permissions } = useAuth();
  const [tab, setTab] = useState("assessments");
  const [selected, setSelected] = useState("");
  const query = useQuery(session ? () => loadGradebook() : null, [session]);
  const learners = query.data?.gradebook?.learners ?? [];
  const learner = learners.find((l) => l.user === selected);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Assessment book"
        description="Read each learner’s assessed work and feedback. Manage shared rubrics for the course."
      />
      <div className="mb-6 flex gap-2">
        <Button
          aria-pressed={tab === "assessments"}
          variant={tab === "assessments" ? "default" : "outline"}
          onClick={() => setTab("assessments")}
        >
          Assessments
        </Button>
        <Button
          aria-pressed={tab === "rubrics"}
          variant={tab === "rubrics" ? "default" : "outline"}
          onClick={() => setTab("rubrics")}
        >
          Rubrics
        </Button>
      </div>
      {tab === "rubrics" ? (
        <StandardManager />
      ) : query.loading ? (
        <LoadingState label="Loading assessments..." />
      ) : query.error ? (
        <ErrorState message={query.error} onRetry={query.refetch} />
      ) : (
        <div className="space-y-6">
          <label className="block space-y-2">
            <span className="text-sm font-medium">Learner</span>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">Select a learner…</option>
              {learners.map((l) => (
                <option key={l.user} value={l.user}>
                  {l.displayName ?? l.email}
                </option>
              ))}
            </select>
          </label>
          {learner ? (
            <>
              <div className="flex flex-wrap gap-3">
                {permissions.can("student-records") && (
                  <Link
                    className="text-sm underline"
                    href={`/staff/students/${learner.user}`}
                  >
                    View learner profile
                  </Link>
                )}
                <details className="text-sm">
                  <summary className="cursor-pointer underline">
                    Assess work from an assignment
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {query.data?.gradebook.items.map((item) => (
                      <li key={item.item}>
                        <Link
                          className="underline"
                          href={`/staff/assignments/${item.item}`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
              <AssessmentHistory
                key={learner.user}
                assessments={learner.grades}
                staff
              />
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {learners.map((l) => (
                <button
                  key={l.user}
                  type="button"
                  onClick={() => setSelected(l.user)}
                  className="rounded-lg border border-border p-4 text-left hover:bg-muted"
                >
                  <p className="font-medium">{l.displayName ?? l.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {l.grades.length
                      ? "View assessment history"
                      : "No assessments yet"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

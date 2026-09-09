"use client";
import { ArrowLeft, ArrowUpRight, ChevronRight, Search } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Fact, Facts } from "@/components/facts";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadGradebook } from "@/lib/lms";

export default function GradebookPage() {
  return (
    <Suspense
      fallback={
        <PageContainer>
          <LoadingState label="Loading assessments..." />
        </PageContainer>
      }
    >
      <GradebookContent />
    </Suspense>
  );
}
function GradebookContent() {
  const { session, permissions } = useAuth();
  const params = useSearchParams();
  const selected = params.get("learner");
  const search = params.get("q") ?? "";
  const [draftSearch, setDraftSearch] = useState<string | null>(null);
  const term = draftSearch ?? search;
  const query = useQuery(session ? () => loadGradebook() : null, [session]);
  const learners = query.data?.gradebook?.learners ?? [];
  const learner = learners.find((l) => l.user === selected);
  const listHref = search
    ? `/staff/gradebook?q=${encodeURIComponent(search)}`
    : "/staff/gradebook";
  const filtered = learners.filter((l) =>
    `${l.displayName ?? ""} ${l.email}`
      .toLocaleLowerCase()
      .includes(term.trim().toLocaleLowerCase()),
  );
  return (
    <PageContainer>
      {selected && (
        <Link
          href={listHref}
          onClick={() => setDraftSearch(null)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to learners
        </Link>
      )}
      <PageHeader
        eyebrow={selected ? "Assessments" : "Course"}
        title={learner ? (learner.displayName ?? learner.email) : "Assessments"}
      />
      {permissions.can("grade") && query.data && !query.error && (
        <details className="mb-5 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            Assess an assignment
          </summary>
          {query.data.gradebook.items.length ? (
            <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
              {query.data.gradebook.items.map((item) => (
                <li key={item.item}>
                  <Link
                    className="underline underline-offset-4"
                    href={`/staff/assignments/${item.item}`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">
              No assessment items yet.
            </p>
          )}
        </details>
      )}
      {query.loading ? (
        <LoadingState label="Loading assessments..." />
      ) : query.error ? (
        <ErrorState message={query.error} onRetry={query.refetch} />
      ) : selected ? (
        learner ? (
          <div className="space-y-5">
            {permissions.can("student-records") && (
              <Link
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                href={`/staff/students/${learner.user}`}
              >
                View profile
                <ArrowUpRight className="size-3.5" />
              </Link>
            )}
            <AssessmentHistory
              key={learner.user}
              assessments={learner.grades}
              staff
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This learner is not available in the assessment list.
          </p>
        )
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-3 top-3 size-4 text-muted-foreground"
            />
            <Input
              aria-label="Search learners"
              placeholder="Search learners…"
              value={term}
              onChange={(e) => setDraftSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="divide-y rounded-lg border">
            {filtered.map((l) => (
              <Link
                key={l.user}
                href={`/staff/gradebook?learner=${encodeURIComponent(l.user)}${term ? `&q=${encodeURIComponent(term)}` : ""}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <div>
                  <p className="text-sm font-medium">
                    {l.displayName ?? l.email}
                  </p>
                  {l.displayName && (
                    <p className="text-xs text-muted-foreground">{l.email}</p>
                  )}
                </div>
                <Facts as="div" className="text-xs text-muted-foreground">
                  <Fact.Count n={l.grades.length} noun="assessment" />
                  <ChevronRight className="size-4" />
                </Facts>
              </Link>
            ))}
            {filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                {learners.length
                  ? "No learners match your search."
                  : "No learners yet."}
              </p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

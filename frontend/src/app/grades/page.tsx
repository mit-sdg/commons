"use client";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { MarkHistory } from "@/components/lms/mark-history";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadGradesForMe, loadMarksForMe } from "@/lib/lms";
export default function GradesPage() {
  const { session } = useAuth();
  const grades = useQuery(session ? () => loadGradesForMe() : null, [session]);
  const marks = useQuery(session ? () => loadMarksForMe() : null, [session]);
  const loading = grades.loading || marks.loading;
  const error = grades.error ?? marks.error;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Grades"
        description="Released point grades, competency assessments, and feedback on your work."
      />
      {loading ? (
        <LoadingState label="Loading grades…" />
      ) : error ? (
        <ErrorState
          message={error}
          refused={grades.refused || marks.refused}
          onRetry={() => {
            void Promise.all([grades.refetch(), marks.refetch()]);
          }}
        />
      ) : (
        <div className="space-y-8">
          {(marks.data?.marks.length ?? 0) > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Point grades</h2>
              <MarkHistory marks={marks.data?.marks ?? []} />
            </section>
          )}
          {((grades.data?.grades.length ?? 0) > 0 ||
            (marks.data?.marks.length ?? 0) === 0) && (
            <section className="space-y-4">
              {(marks.data?.marks.length ?? 0) > 0 && (
                <h2 className="text-lg font-semibold">
                  Competency assessments
                </h2>
              )}
              <AssessmentHistory assessments={grades.data?.grades ?? []} />
            </section>
          )}
        </div>
      )}
    </PageContainer>
  );
}

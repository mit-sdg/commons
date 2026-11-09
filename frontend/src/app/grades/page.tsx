"use client";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import type { Assessment } from "@/lib/grading";
import { loadGradesForMe } from "@/lib/lms";
export default function GradesPage() {
  const { session } = useAuth();
  const grades = useQuery(session ? () => loadGradesForMe() : null, [session]);
  const loading = grades.loading;
  const error = grades.error;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Grades"
        description="Released assessments and feedback on your work."
      />
      {loading ? (
        <LoadingState label="Loading grades…" />
      ) : error ? (
        <ErrorState
          message={error}
          refused={grades.refused}
          onRetry={grades.refetch}
        />
      ) : (
        <AssessmentHistory
          assessments={(grades.data?.grades ?? []) as Assessment[]}
        />
      )}
    </PageContainer>
  );
}

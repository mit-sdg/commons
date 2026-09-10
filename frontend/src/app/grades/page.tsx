"use client";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadGradesForMe } from "@/lib/lms";
export default function GradesPage() {
  const { session } = useAuth();
  const { data, loading, error, refused, refetch } = useQuery(
    session ? () => loadGradesForMe() : null,
    [session],
  );
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Course"
        title="Assessments"
        description="The skills demonstrated in your work, with the evidence and feedback behind each assessment."
      />
      {loading ? (
        <LoadingState label="Loading assessments…" />
      ) : error ? (
        <ErrorState message={error} refused={refused} onRetry={refetch} />
      ) : (
        <AssessmentHistory assessments={data?.grades ?? []} />
      )}
    </PageContainer>
  );
}

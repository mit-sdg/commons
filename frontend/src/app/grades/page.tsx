"use client";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import type { Assessment } from "@/lib/grading";
import { loadGradesForMe, loadSections } from "@/lib/lms";
import { teamNamesOf } from "@/lib/teams";
export default function GradesPage() {
  const { session, me } = useAuth();
  const grades = useQuery(session ? () => loadGradesForMe() : null, [session]);
  // A team's grade names the team as its learner.
  const onTeam = me
    ? (grades.data?.grades ?? []).some(
        (grade) => String(grade.learner) !== String(me.user),
      )
    : false;
  const teams = useQuery(onTeam ? () => loadSections() : null, [onTeam]);
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
          teamNames={teamNamesOf(teams.data?.sections)}
        />
      )}
    </PageContainer>
  );
}

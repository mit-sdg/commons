"use client";
import { AssessmentHistory } from "@/components/lms/assessment-history";
import { CourseGradeCard } from "@/components/lms/course-grade-card";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadMyCourseGrade } from "@/lib/course-grades";
import type { Assessment } from "@/lib/grading";
import { loadGradesForMe } from "@/lib/lms";
export default function GradesPage() {
  const { session } = useAuth();
  const grades = useQuery(session ? () => loadGradesForMe() : null, [session]);
  // Refused for anyone who is not an active student; then there is no card.
  const courseGrade = useQuery(session ? () => loadMyCourseGrade() : null, [
    session,
  ]);
  const mine = courseGrade.data;
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
        <>
          {mine &&
            (mine.state === "released" && mine.card ? (
              <CourseGradeCard card={mine.card} className="mb-6" />
            ) : (
              <CourseGradeCard
                state={mine.state === "withdrawn" ? "withdrawn" : "none"}
                className="mb-6"
              />
            ))}
          <AssessmentHistory
            assessments={(grades.data?.grades ?? []) as Assessment[]}
          />
        </>
      )}
    </PageContainer>
  );
}

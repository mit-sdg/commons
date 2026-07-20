"use client";

import { GraduationCap } from "lucide-react";
import { StatusBadge } from "@/components/lms/status-badge";
import { PageContainer, PageHeader } from "@/components/page";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadGradesForMe, loadRosterMe } from "@/lib/lms";

export default function GradesPage() {
  const { session } = useAuth();

  const { data: rosterData } = useQuery<{ seat: unknown }>(
    session ? () => loadRosterMe() : null,
    [session],
  );

  const {
    data: gradesData,
    loading,
    error,
    refetch,
  } = useQuery(session && rosterData?.seat ? () => loadGradesForMe() : null, [
    session,
    rosterData,
  ]);

  const { data: detailsData } = useQuery<Record<string, unknown>>(
    gradesData
      ? async () => {
          const map: Record<string, unknown> = {};
          const grades = gradesData.grades;
          await Promise.all(
            grades.map(async (g) => {
              const item = g.item;
              if (!map[item]) {
                const res = await api.assignments.get({
                  assignment: item,
                });
                if (!("error" in res) && res.assignment)
                  map[item] = res.assignment;
              }
            }),
          );
          return map;
        }
      : null,
    [gradesData],
  );

  if (loading)
    return (
      <PageContainer>
        <LoadingState label="Loading grades..." />
      </PageContainer>
    );
  if (error)
    return (
      <PageContainer>
        <ErrorState message={error} onRetry={refetch} />
      </PageContainer>
    );

  const grades = gradesData?.grades ?? [];
  const details = (detailsData ?? {}) as Record<
    string,
    { title: string; kind: string }
  >;

  const released = grades.filter(
    (g) => g.status === "RELEASED" || g.status === "EXCUSED",
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Commons"
        title="Grades"
        description="Your released grades."
      />

      {released.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No grades yet"
          description="Grades will appear here once your instructor releases them."
        />
      ) : (
        <div className="space-y-3">
          {released.map((g) => {
            const detail = details[g.item];
            return (
              <Card key={g.grade}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {detail?.title ?? g.label ?? g.item.slice(0, 8)}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={g.status} />
                      {g.status !== "EXCUSED" && (
                        <span className="text-xl font-semibold tabular-nums">
                          {g.score}
                          <span className="text-muted-foreground text-base">
                            /{g.maxPoints}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {g.feedback && (
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {g.feedback}
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}

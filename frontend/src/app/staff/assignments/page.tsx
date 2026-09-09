"use client";

import { BookOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { StatusBadge } from "@/components/lms/status-badge";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { assignmentTypeLabel } from "@/lib/assignment-types";
import { useAuth } from "@/lib/auth";
import { loadSections, loadStaffAssignments } from "@/lib/lms";

function StaffAssignmentsPageContent() {
  const { session } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  const {
    data: asgnData,
    loading,
    error,
    refetch,
  } = useQuery<{
    assignments: {
      assignment: string;
      title: string;
      kind: string;
      status: string;
      dueAt: string;
      availableAt: string;
      audience: string;
      targets: string[];
    }[];
  }>(session ? () => loadStaffAssignments() : null, [session]);

  const sectionsQuery = useQuery(session ? () => loadSections() : null, [
    session,
  ]);
  const sectionNames = new Map(
    (sectionsQuery.data?.sections ?? []).map((section) => [
      String(section.section),
      section.name,
    ]),
  );

  const filters = [
    { key: "all", label: "All" },
    { key: "DRAFT", label: "Draft" },
    { key: "PUBLISHED", label: "Published" },
    { key: "ARCHIVED", label: "Archived" },
  ];

  const assignments = asgnData?.assignments ?? [];
  const filtered =
    filter === "all"
      ? assignments
      : assignments.filter((a) => a.status === filter);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Assignments"
        actions={
          <Button asChild>
            <Link href="/staff/assignments/new">
              <Plus className="size-4 mr-1" /> New assignment
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex items-center gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            aria-pressed={filter === f.key}
            size="sm"
            variant={filter === f.key ? "default" : "outline"}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Loading assignments..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={
            assignments.length === 0
              ? "No assignments yet"
              : `No ${filter.toLowerCase()} assignments`
          }
          action={
            assignments.length === 0 ? (
              <Button asChild size="sm">
                <Link href="/staff/assignments/new">Create assignment</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
              >
                Show all assignments
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Link
              key={a.assignment}
              href={`/staff/assignments/${a.assignment}`}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{a.title}</p>
                  <Fact.Kind>{assignmentTypeLabel(a.kind)}</Fact.Kind>
                </div>
                <Facts className="text-xs text-muted-foreground mt-1">
                  <Fact.Due verb="Due" at={a.dueAt} />
                  <Fact.Where preposition="for">
                    {a.audience === "EVERYONE"
                      ? "All students"
                      : a.targets
                          .map(
                            (target) =>
                              sectionNames.get(target) ?? "Unknown section",
                          )
                          .join(", ")}
                  </Fact.Where>
                </Facts>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

export default function StaffAssignmentsPage() {
  return (
    <RequireCapability capability="course:manage">
      <StaffAssignmentsPageContent />
    </RequireCapability>
  );
}

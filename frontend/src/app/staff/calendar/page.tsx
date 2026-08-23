"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CalendarView } from "@/components/lms/calendar-view";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { loadCalendarStaff } from "@/lib/lms";

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
    label: `${monday.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en", { month: "short", day: "numeric" })}`,
  };
}

function StaffCalendarPageContent() {
  const { session } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const { start, end, label } = getWeekRange(weekOffset);

  const {
    data: calendarData,
    loading,
    error,
    refetch,
  } = useQuery<{
    events: { assignment: string }[];
  }>(session ? () => loadCalendarStaff(start, end) : null, [
    session,
    start,
    end,
  ]);

  const { data: detailsData } = useQuery<Record<string, unknown>>(
    calendarData?.events
      ? async () => {
          const map: Record<string, unknown> = {};
          await Promise.all(
            calendarData.events.map(async (e) => {
              const key = e.assignment;
              if (!map[key]) {
                const res = await api.assignments["staff-summary"]({
                  assignment: key,
                });
                if (!("error" in res) && res.summary) map[key] = res.summary;
              }
            }),
          );
          return map;
        }
      : null,
    [calendarData],
  );

  const details = (detailsData ?? {}) as Record<
    string,
    {
      title: string;
      kind: string;
      dueAt: string;
      closeAt?: string;
      status: string;
    }
  >;

  const events = (calendarData?.events ?? []).flatMap((e) => {
    const d = details[e.assignment];
    const name = d?.title ?? e.assignment.slice(0, 8);
    return [
      d?.dueAt
        ? {
            date: d.dueAt,
            label: `Due: ${name}`,
            kind: "due",
            detail: d.kind,
          }
        : null,
      d?.closeAt
        ? {
            date: d.closeAt,
            label: `Closes: ${name}`,
            kind: "close",
            detail: d.kind,
          }
        : null,
    ].filter(Boolean) as {
      date: string;
      label: string;
      kind?: string;
      detail?: string;
    }[];
  });

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Staff"
        title="Calendar"
        description="Assignment due and close dates across all sections."
      />

      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            aria-label="Next week"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
          This week
        </Button>
      </div>

      {loading ? (
        <LoadingState label="Loading calendar..." />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <CalendarView events={events} />
        </div>
      )}
    </PageContainer>
  );
}

export default function StaffCalendarPage() {
  return (
    <RequireCapability
      capability={["course:manage", "grade", "student-records"]}
    >
      <StaffCalendarPageContent />
    </RequireCapability>
  );
}

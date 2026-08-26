"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CalendarView } from "@/components/lms/calendar-view";
import { PageContainer, PageHeader } from "@/components/page";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/lib/auth";
import { loadCalendarMe, loadRosterMe } from "@/lib/lms";

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

export default function CalendarPage() {
  const { session } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const { start, end, label } = getWeekRange(weekOffset);

  const { data: rosterData } = useQuery<{ seat: unknown }>(
    session ? () => loadRosterMe() : null,
    [session],
  );

  const {
    data: calendarData,
    loading,
    error,
    refetch,
  } = useQuery<{
    events: {
      assignment: string;
      title: string;
      kind: string;
      availableAt: string;
      dueAt: string;
      dueOverride: string | null;
      closeAt: string | null;
    }[];
  }>(session && rosterData?.seat ? () => loadCalendarMe(start, end) : null, [
    session,
    rosterData,
    start,
    end,
  ]);

  const events = (calendarData?.events ?? []).flatMap((event) => {
    const dueAt = event.dueOverride ?? event.dueAt;
    return [
      {
        date: event.availableAt,
        label: `Available: ${event.title}`,
        kind: "available",
        detail: event.kind,
      },
      {
        date: dueAt,
        label: `Due: ${event.title}`,
        kind: "due",
        detail: event.dueOverride
          ? `${event.kind} · individual due date`
          : event.kind,
      },
      event.closeAt
        ? {
            date: event.closeAt,
            label: `Closes: ${event.title}`,
            kind: "close",
            detail: event.kind,
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
        eyebrow="Commons"
        title="Calendar"
        description="Assignment availability, due dates, and close dates."
      />

      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous week"
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next week"
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <span className="text-sm font-medium">{label}</span>
        <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
          Today
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

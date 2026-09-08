"use client";

import { CalendarDays } from "lucide-react";
import { Fact, Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { courseTimezone } from "@/lib/course";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  date: string;
  label: string;
  kind?: string;
  /** The kind of the assignment: essay, quiz. */
  detail?: string;
  /** A note on this date alone: "individual due date". */
  note?: string;
  href: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  className?: string;
}

export function CalendarView({ events, className }: CalendarViewProps) {
  if (events.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground",
          className,
        )}
      >
        <CalendarDays className="size-6" />
        <p className="text-sm">No events in this range.</p>
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  return (
    <div className={cn("divide-y divide-border", className)}>
      {sorted.map((event, i) => {
        const date = new Date(event.date);
        const isPast = date < new Date();
        return (
          <Link
            key={`${event.date}-${event.label || i}`}
            href={event.href}
            className={cn(
              "flex items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/50",
              isPast ? "text-muted-foreground" : "text-foreground",
            )}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-card text-xs font-medium">
              {date.toLocaleDateString("en", {
                month: "short",
                day: "numeric",
                timeZone: courseTimezone(),
              })}
            </div>
            <div className="min-w-0 flex-1">
              <Facts className="gap-x-2">
                <span className="text-sm font-medium truncate">
                  {event.label}
                </span>
                {event.detail ? <Fact.Kind>{event.detail}</Fact.Kind> : null}
              </Facts>
              <Facts className="mt-0.5 text-xs">
                <Fact.Due at={event.date} />
                {event.note ? (
                  <span className="text-muted-foreground">{event.note}</span>
                ) : null}
              </Facts>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

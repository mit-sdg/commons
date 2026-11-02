"use client";

import { CalendarCheck, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { Facts } from "@/components/facts";
import { Link } from "@/components/link";
import { LectureSwitch } from "@/components/live/lecture-switch";
import { FormTag } from "@/components/live/quiz-meta";
import { PageContainer, PageHeader } from "@/components/page";
import { RequireCapability } from "@/components/require-capability";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@/hooks/use-query";
import {
  type AttendanceGrid,
  attendanceCsv,
  attendanceGrid,
  gridForSection,
  type Lecture,
  lectureLabel,
  loadAttendance,
  openedTime,
} from "@/lib/attendance";
import { useAuth } from "@/lib/auth";
import { useCourse } from "@/lib/course";
import { downloadCsv } from "@/lib/csv";
import { loadSections } from "@/lib/lms";
import { cn } from "@/lib/utils";

const ALL = "all";

const STICKY_NAME = "sticky left-0 z-10 border-e border-border bg-card";
const HEAD =
  "sticky top-0 z-20 border-b border-border bg-muted px-3 py-2 text-start align-bottom font-medium text-muted-foreground whitespace-nowrap";

function Mark({ present }: { present: boolean }) {
  return (
    <span
      role="img"
      aria-label={present ? "Present" : "Absent"}
      className={cn(
        "inline-block size-3 rounded-full",
        present ? "bg-foreground" : "border border-muted-foreground/50",
      )}
    />
  );
}

function AttendanceTable({
  grid,
  showSection,
  sectionName,
  onOpen,
}: {
  grid: AttendanceGrid;
  showSection: boolean;
  sectionName: (section: string | null) => string;
  onOpen: (date: string) => void;
}) {
  return (
    <div className="relative max-h-[75vh] overflow-auto rounded-xl border border-border bg-card">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className={cn(HEAD, STICKY_NAME, "z-30 bg-muted")}>Student</th>
            {grid.lectures.map((lecture) => (
              <th key={lecture.date} className={cn(HEAD, "text-center")}>
                <button
                  type="button"
                  onClick={() => onOpen(lecture.date)}
                  className="rounded-sm underline decoration-foreground/30 decoration-dotted underline-offset-4 hover:text-foreground hover:decoration-solid focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {lectureLabel(lecture.date)}
                </button>
              </th>
            ))}
            <th className={cn(HEAD, "text-end")}>Attended</th>
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.user} className="hover:[&>td]:bg-muted/40">
              <td
                className={cn(
                  STICKY_NAME,
                  "border-b px-3 py-2 whitespace-nowrap",
                )}
              >
                <Facts as="div" className="flex-nowrap">
                  <span dir="auto" title={row.email} className="font-medium">
                    {row.name}
                  </span>
                  {showSection && row.section !== null ? (
                    <span className="text-muted-foreground">
                      {sectionName(row.section)}
                    </span>
                  ) : null}
                </Facts>
              </td>
              {grid.lectures.map((lecture) => (
                <td
                  key={lecture.date}
                  className="border-b border-border px-3 py-2 text-center"
                >
                  <Mark present={row.present.has(lecture.date)} />
                </td>
              ))}
              <td className="border-b border-border px-3 py-2 text-end tabular-nums">
                {row.percent === null ? "" : `${row.percent}%`}
              </td>
            </tr>
          ))}
          {grid.rows.length === 0 ? (
            <tr>
              <td
                colSpan={grid.lectures.length + 2}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                No students
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LectureDialog({
  lecture,
  timezone,
  onClose,
  onChanged,
}: {
  lecture: Lecture | null;
  timezone: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  return (
    <Dialog open={lecture !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {lecture !== null ? (
          <>
            <DialogHeader>
              <DialogTitle>{lectureLabel(lecture.date)}</DialogTitle>
            </DialogHeader>
            <ul className="divide-y divide-border">
              {lecture.runs.map((run) => (
                <li
                  key={run.run}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
                >
                  <Facts className="min-w-0 text-sm">
                    <span dir="auto">{run.title}</span>
                    <FormTag form={run.kind} />
                    <span className="text-muted-foreground">
                      {openedTime(run.openedAt, timezone)}
                    </span>
                  </Facts>
                  <LectureSwitch run={run.run} lecture onChanged={onChanged} />
                </li>
              ))}
            </ul>
            {lecture.signedOut > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {lecture.signedOut}
                </span>{" "}
                joined without signing in
              </p>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AttendanceContent() {
  const { session } = useAuth();
  const course = useCourse();
  const [section, setSection] = useState<string>(ALL);
  const [openDate, setOpenDate] = useState<string | null>(null);

  const query = useQuery(session ? () => loadAttendance() : null, [session]);
  const sectionsQuery = useQuery(session ? () => loadSections() : null, [
    session,
  ]);

  const grid = useMemo(
    () => (query.data ? attendanceGrid(query.data) : null),
    [query.data],
  );
  const sectionNames = useMemo(
    () =>
      new Map(
        (sectionsQuery.data?.sections ?? []).map((entry) => [
          String(entry.section),
          entry.name,
        ]),
      ),
    [sectionsQuery.data],
  );
  // Only the sections some student is in, by name.
  const sections = useMemo(() => {
    const held = new Set(
      (grid?.rows ?? []).flatMap((row) =>
        row.section === null ? [] : [row.section],
      ),
    );
    return [...sectionNames]
      .filter(([id]) => held.has(id))
      .sort(([, left], [, right]) => left.localeCompare(right));
  }, [grid, sectionNames]);
  const showSection = sections.length > 1;
  const chosen = showSection && section !== ALL ? section : null;
  const sectionName = (id: string | null) =>
    id === null ? "" : (sectionNames.get(id) ?? "");

  let body: React.ReactNode;
  if (query.error) {
    body = (
      <ErrorState
        message={query.error}
        refused={query.refused}
        onRetry={query.refetch}
      />
    );
  } else if (grid === null) {
    body = <LoadingState label="Loading attendance…" />;
  } else if (grid.lectures.length === 0) {
    body = (
      <EmptyState
        icon={CalendarCheck}
        title="No lectures marked"
        action={
          <Button size="sm" asChild>
            <Link href="/staff/attendance/runs">Mark lectures</Link>
          </Button>
        }
      />
    );
  } else {
    const shown = gridForSection(grid, chosen);
    const openLecture =
      grid.lectures.find((lecture) => lecture.date === openDate) ?? null;
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showSection ? (
            <Select value={chosen ?? ALL} onValueChange={setSection}>
              <SelectTrigger aria-label="Section" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All sections</SelectItem>
                {sections.map(([id, name]) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => {
              const title = [
                course.code || course.title,
                chosen && sectionName(chosen),
              ]
                .filter(Boolean)
                .join(" ");
              const { filename, csv } = attendanceCsv(
                shown,
                sectionNames,
                title,
              );
              downloadCsv(filename, csv);
            }}
          >
            <Download /> Download CSV
          </Button>
        </div>
        <AttendanceTable
          grid={shown}
          showSection={showSection && chosen === null}
          sectionName={sectionName}
          onOpen={setOpenDate}
        />
        <LectureDialog
          lecture={openLecture}
          timezone={grid.timezone}
          onClose={() => setOpenDate(null)}
          onChanged={query.refetch}
        />
      </div>
    );
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        eyebrow="Staff"
        title="Attendance"
        actions={
          // The empty state carries this link when no lecture is marked.
          query.error || (grid !== null && grid.lectures.length > 0) ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/staff/attendance/runs">Mark lectures</Link>
            </Button>
          ) : null
        }
      />
      {body}
    </PageContainer>
  );
}

export default function AttendancePage() {
  return (
    <RequireCapability
      capability={[
        "course:manage",
        "grade",
        "student-records",
        "moderate",
        "live:host",
      ]}
    >
      <AttendanceContent />
    </RequireCapability>
  );
}

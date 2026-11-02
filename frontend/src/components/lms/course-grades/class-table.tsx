"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import {
  type CoursePolicy,
  type ShowAs,
  type StudentGrade,
  showAverage,
  showGrade,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import {
  movedPolicyGrade,
  reasonOf,
  showLetter,
  type TableRow,
} from "./class-helpers";

const TAG =
  "rounded border border-border px-1 text-[10.5px] font-semibold tracking-[0.04em] uppercase text-muted-foreground";

/** The grade with its tag: Override or Attendance, and "policy: C" when an override's policy grade moved. */
function GradeCell({
  grade,
  policy,
  showAs,
}: {
  grade: StudentGrade;
  policy: CoursePolicy;
  showAs: ShowAs;
}) {
  const moved = movedPolicyGrade(grade);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block min-w-[30px] rounded-md border border-border px-1.5 py-px text-center text-[13px] font-semibold",
          grade.override && "border-foreground",
          !grade.override &&
            grade.cappedBy &&
            "border-dashed border-foreground",
        )}
      >
        {showGrade(grade, policy, showAs)}
      </span>
      {grade.override ? (
        <span className={TAG}>Override</span>
      ) : grade.cappedBy ? (
        <span className={TAG}>Attendance</span>
      ) : null}
      {moved && (
        <span className="text-xs text-muted-foreground">
          policy: {showLetter(moved, policy, showAs)}
        </span>
      )}
    </span>
  );
}

export function ClassTable({
  rows,
  policy,
  showAs,
  studentOf,
  sectionName,
  compared,
  showReasons,
  open,
  onToggle,
  renderOpened,
}: {
  rows: TableRow[];
  policy: CoursePolicy;
  showAs: ShowAs;
  studentOf: (student: string) => { name: string; section: string | null };
  sectionName: (section: string | null) => string | null;
  /** The compared policy and each student's grade under it, while comparing. */
  compared: {
    policy: CoursePolicy;
    grades: Map<string, StudentGrade>;
  } | null;
  showReasons: boolean;
  open: string | null;
  onToggle: (student: string) => void;
  renderOpened: (grade: StudentGrade) => ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [boxWidth, setBoxWidth] = useState(0);
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setBoxWidth(entry?.contentRect.width ?? 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const columns =
    4 + policy.groups.length + (compared ? 1 : 0) + (showReasons ? 1 : 0);
  const show = (value: number | null) => showAverage(value, policy, showAs);
  const head =
    "px-3 pt-2.5 pb-2 text-xs font-medium whitespace-nowrap text-muted-foreground";

  return (
    <div
      ref={box}
      className="overflow-x-auto rounded-xl border border-border bg-card"
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className={cn(head, "text-left")}>Student</th>
            {policy.groups.map((group) => (
              <th key={group.key} className={cn(head, "text-right")}>
                {group.name}
              </th>
            ))}
            <th className={cn(head, "text-right text-foreground")}>Average</th>
            <th className={cn(head, "text-left")}>Grade</th>
            {compared && <th className={cn(head, "text-left")}>Compared</th>}
            <th className={cn(head, "text-right")}>Lectures</th>
            {showReasons && <th className={cn(head, "text-left")}>Reason</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns}
                className="px-3 py-7 text-center text-muted-foreground"
              >
                No students match.
              </td>
            </tr>
          )}
          {rows.map((row) => {
            if (row.kind === "divider")
              return (
                <tr key={`line:${row.line.grade}`} aria-hidden>
                  <td colSpan={columns} className="h-6 px-3 py-0">
                    <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {showLetter(row.line.grade, policy, showAs)} from{" "}
                        {show(row.line.at)}
                      </span>
                      <span className="h-[1.5px] flex-1 bg-foreground/70" />
                    </span>
                  </td>
                </tr>
              );
            const { grade } = row;
            const student = studentOf(grade.student);
            const section = sectionName(student.section);
            const isOpen = open === grade.student;
            const theirs = compared?.grades.get(grade.student) ?? null;
            return (
              <Fragment key={grade.student}>
                <tr
                  id={`course-grade-${grade.student}`}
                  className={cn(
                    "cursor-pointer border-b border-border hover:bg-foreground/[0.04]",
                    isOpen && "border-transparent bg-foreground/[0.04]",
                  )}
                  onClick={() => onToggle(grade.student)}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      className="text-left font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(grade.student);
                      }}
                    >
                      {student.name}
                    </button>
                    {section && (
                      <div className="text-xs text-muted-foreground">
                        {section}
                      </div>
                    )}
                  </td>
                  {grade.groups.map((group) => (
                    <td
                      key={group.key}
                      className="px-3 py-2 text-right tabular-nums whitespace-nowrap"
                    >
                      {show(group.value)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                    {show(grade.average)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <GradeCell grade={grade} policy={policy} showAs={showAs} />
                  </td>
                  {compared && (
                    <td
                      className={cn(
                        "px-3 py-2 whitespace-nowrap",
                        theirs?.policyGrade === grade.policyGrade
                          ? "text-muted-foreground"
                          : "font-semibold",
                      )}
                    >
                      {theirs
                        ? showGrade(
                            {
                              ...theirs,
                              grade: theirs.policyGrade,
                              override: null,
                            },
                            compared.policy,
                            showAs,
                          )
                        : "–"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                    {grade.lectures.total > 0
                      ? `${grade.lectures.attended} of ${grade.lectures.total}`
                      : "–"}
                  </td>
                  {showReasons && (
                    <td className="max-w-[20rem] min-w-[12rem] px-3 py-2 text-muted-foreground">
                      {reasonOf(grade)}
                    </td>
                  )}
                </tr>
                {isOpen && (
                  <tr className="border-b border-border bg-foreground/[0.04]">
                    <td colSpan={columns} className="p-0">
                      <div
                        className="sticky left-0 px-3 pt-1 pb-4"
                        style={boxWidth ? { width: boxWidth } : undefined}
                      >
                        {renderOpened(grade)}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

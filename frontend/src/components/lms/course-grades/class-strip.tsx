"use client";

import { useEffect, useRef, useState } from "react";
import { LEVEL_NAMES } from "@/components/lms/grades/common";
import {
  type CoursePolicy,
  type ShowAs,
  type StudentGrade,
  showAverage,
} from "@/lib/course-grades";
import { cn } from "@/lib/utils";
import {
  moveLine,
  type RatingName,
  showLetter,
  stackDots,
  stripRange,
} from "./class-helpers";

const DOT = 9;

/** A dot per student at their average, in neutral ink, with the policy's cutoffs on top. */
export function DotStrip({
  grades,
  policy,
  showAs,
  readOnly,
  onChange,
  highlighted,
  nameOf,
  onOpen,
}: {
  grades: StudentGrade[];
  policy: CoursePolicy;
  showAs: ShowAs;
  readOnly: boolean;
  onChange: (policy: CoursePolicy) => void;
  /** The students the filters show; null when nothing is filtered. */
  highlighted: Set<string> | null;
  nameOf: (student: string) => string;
  onOpen: (student: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<{
    grade: string;
    range: { low: number; high: number };
  } | null>(null);

  useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry?.contentRect.width ?? 0),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // While a cutoff is dragged, the range holds still so the line tracks the pointer.
  const range = dragging?.range ?? stripRange(grades, policy);
  const span = range.high - range.low;
  const x = (value: number) => ((value - range.low) / span) * width;
  const dots = width > 0 ? stackDots(grades, x, DOT) : [];
  const tallest = dots.reduce((most, dot) => Math.max(most, dot.layer + 1), 0);
  const height = Math.max(72, tallest * DOT + 8);
  const lines = policy.lines[policy.gradeSet];
  const ticks = (Object.entries(policy.ratings) as [RatingName, number][])
    .filter(([, value]) => value >= range.low && value <= range.high)
    .sort((left, right) => left[1] - right[1]);

  function valueAt(clientX: number) {
    const rect = strip.current!.getBoundingClientRect();
    return range.low + ((clientX - rect.left) / rect.width) * span;
  }

  function move(grade: string, at: number) {
    onChange(moveLine(policy, grade, at, range));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card px-4 pt-8 pb-2 sm:px-5">
      <div
        ref={strip}
        className="relative border-b border-border"
        style={{ height, touchAction: dragging ? "none" : undefined }}
      >
        {dots.map((dot) => (
          <button
            key={dot.student}
            type="button"
            tabIndex={-1}
            aria-label={`${nameOf(dot.student)} ${showAverage(dot.average, policy, showAs)}`}
            title={`${nameOf(dot.student)} ${showAverage(dot.average, policy, showAs)}`}
            onClick={() => onOpen(dot.student)}
            className={cn(
              "absolute size-[7px] -translate-x-1/2 rounded-full bg-foreground/75 hover:bg-foreground",
              highlighted &&
                (highlighted.has(dot.student)
                  ? "ring-2 ring-foreground ring-offset-1 ring-offset-card"
                  : "opacity-25"),
            )}
            style={{ left: dot.left, bottom: 3 + dot.layer * DOT }}
          />
        ))}
        {width > 0 &&
          lines.map((line) => (
            <div
              key={line.grade}
              className="pointer-events-none absolute -top-7 -bottom-1.5 z-10"
              style={{ left: x(line.at) }}
            >
              <span
                aria-hidden
                className="absolute top-5 bottom-0 -left-px w-0.5 bg-foreground/75"
              />
              <button
                type="button"
                disabled={readOnly}
                aria-label={`${line.grade} cutoff at ${line.at.toFixed(2)}`}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-xs font-semibold whitespace-nowrap text-background select-none",
                  !readOnly && "cursor-ew-resize touch-none",
                  dragging?.grade === line.grade && "ring-2 ring-foreground/30",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                )}
                onPointerDown={(event) => {
                  if (readOnly) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging({ grade: line.grade, range });
                }}
                onPointerMove={(event) => {
                  if (dragging?.grade !== line.grade) return;
                  move(
                    line.grade,
                    Math.round(valueAt(event.clientX) * 20) / 20,
                  );
                }}
                onPointerUp={() => setDragging(null)}
                onPointerCancel={() => setDragging(null)}
                onKeyDown={(event) => {
                  if (readOnly) return;
                  const step =
                    event.key === "ArrowRight"
                      ? 0.01
                      : event.key === "ArrowLeft"
                        ? -0.01
                        : 0;
                  if (step === 0) return;
                  event.preventDefault();
                  move(line.grade, line.at + step * (event.shiftKey ? 10 : 1));
                }}
              >
                {showLetter(line.grade, policy, showAs)}{" "}
                {showAverage(line.at, policy, showAs)}
              </button>
            </div>
          ))}
      </div>
      <div className="relative h-8 text-xs text-muted-foreground">
        {width > 0 &&
          ticks.map(([name, value]) => (
            <span
              key={name}
              className={cn(
                "absolute top-1 leading-tight whitespace-nowrap",
                x(value) < 28
                  ? "text-left"
                  : x(value) > width - 28
                    ? "-translate-x-full text-right"
                    : "-translate-x-1/2 text-center",
              )}
              style={{ left: x(value) }}
            >
              <b className="block font-semibold text-foreground">
                {showAverage(value, policy, showAs)}
              </b>
              {LEVEL_NAMES[name]}
            </span>
          ))}
      </div>
    </div>
  );
}

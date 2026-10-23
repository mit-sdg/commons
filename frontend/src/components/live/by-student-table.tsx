"use client";

import { ArrowUp, CircleAlert, Copy, UserRound, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Tag } from "@/components/tag";
import { InlineHelp } from "@/components/ui/inline-help";
import { cn } from "@/lib/utils";
import {
  type AnswerFilter,
  type AnswerRow,
  type Cell,
  type Column,
  columnLabel,
  filterRows,
  type Member,
  memberName,
  type SortKey,
  STUDENT,
  type StudentTable,
  sortRows,
} from "./by-student";

/** Past this many characters a written answer is cut to two lines until its row is opened. */
const LONG_ANSWER = 80;

const rowId = (participant: string) => `student-${participant}`;

/** Brings a row into view and flashes it, so the eye lands on it. */
function reveal(row: HTMLElement) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  row.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
  if (still) return;
  for (const cell of row.children) {
    const resting = getComputedStyle(cell).backgroundColor;
    cell.animate(
      [
        {
          backgroundColor:
            "color-mix(in oklch, var(--primary) 16%, var(--card))",
        },
        { backgroundColor: resting },
      ],
      { duration: 1600, easing: "ease-out" },
    );
  }
}

function Jump({
  to,
  onJump,
  title,
  children,
}: {
  to: string;
  onJump: (participant: string) => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onJump(to);
      }}
      className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-sm underline decoration-foreground/30 decoration-dotted underline-offset-4 hover:decoration-solid hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring"
    >
      {children}
    </button>
  );
}

function CellView({
  cell,
  open,
  onJump,
}: {
  cell: Cell;
  open: boolean;
  onJump: (participant: string) => void;
}) {
  if (cell.kind === "person")
    return (
      <Jump to={cell.member.user} onJump={onJump} title={cell.typed.trim()}>
        <UserRound
          aria-hidden
          className="size-3.5 shrink-0 self-center text-muted-foreground"
        />
        <span dir="auto">{memberName(cell.member)}</span>
      </Jump>
    );
  if (cell.kind === "unknown")
    return (
      <span
        title="Not on the roster"
        className="inline-flex items-baseline gap-1 whitespace-nowrap"
      >
        <CircleAlert
          aria-hidden
          className="size-3.5 shrink-0 self-center text-destructive"
        />
        <span dir="auto">{cell.typed.trim()}</span>
        <span className="sr-only"> (not on the roster)</span>
      </span>
    );
  if (cell.kind === "choice")
    return (
      <span dir="auto" className="whitespace-nowrap">
        {cell.value}
      </span>
    );
  return (
    <span
      dir="auto"
      className={cn("block min-w-48 max-w-80", !open && "line-clamp-2")}
    >
      {cell.value}
    </span>
  );
}

function Cells({
  cells,
  open,
  onJump,
}: {
  cells: Cell[];
  open: boolean;
  onJump: (participant: string) => void;
}) {
  const [only] = cells;
  if (cells.length === 1 && only !== undefined)
    return <CellView cell={only} open={open} onJump={onJump} />;
  // Repetitions of one box may hold commas, so each is its own quiet chip.
  return (
    <span className="flex flex-wrap gap-1">
      {cells.map((cell, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: repetitions keep the order they were answered in.
          key={index}
          className="rounded-md border border-border bg-muted/50 px-1.5 text-xs leading-5"
        >
          <CellView cell={cell} open onJump={onJump} />
        </span>
      ))}
    </span>
  );
}

const STICKY_NAME = "sticky left-0 z-10 border-e border-border bg-card";
const HEAD =
  "sticky top-0 z-20 bg-muted text-start align-bottom font-medium text-muted-foreground";

function GroupRow({
  label,
  count,
  span,
}: {
  label: string;
  count: number;
  span: number;
}) {
  return (
    <tr>
      {/* One cell across the table, so a long label never widens the name column. */}
      <td
        colSpan={span + 1}
        className="border-b border-border bg-muted py-1.5 text-xs"
      >
        <span className="sticky left-0 inline-block px-3 whitespace-nowrap">
          <span className="me-2 font-semibold text-foreground">{label}</span>{" "}
          <span className="text-muted-foreground tabular-nums">{count}</span>
        </span>
      </td>
    </tr>
  );
}

/**
 * Every answer to a survey run by the person who gave it, beside the roster:
 * who has not handed in, who someone else's answer names, and answers from
 * outside the roster. Model seats never appear.
 */
export function ByStudentTable({
  table,
  showSection,
  sectionName,
  answer,
  onClearAnswer,
}: {
  table: StudentTable;
  showSection: boolean;
  sectionName: (section: string) => string;
  answer: AnswerFilter | null;
  onClearAnswer: () => void;
}) {
  const [sort, setSort] = useState<SortKey>("name");
  const [unknownOnly, setUnknownOnly] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  // A row to reveal once the filters that hid it are cleared.
  const pending = useRef<string | null>(null);

  const columns = table.columns;
  const filtering = answer !== null || unknownOnly;
  const answered = sortRows(
    filterRows(table.answered, columns, answer, unknownOnly),
    columns,
    sort,
    sectionName,
  );
  const outside = filterRows(table.outside, columns, answer, unknownOnly);
  const span = columns.length + (showSection ? 1 : 0);

  function jump(participant: string) {
    const row = document.getElementById(rowId(participant));
    if (row !== null) reveal(row);
    else if (filtering) {
      pending.current = participant;
      setUnknownOnly(false);
      onClearAnswer();
    }
  }

  useEffect(() => {
    if (pending.current === null || filtering) return;
    const row = document.getElementById(rowId(pending.current));
    pending.current = null;
    if (row !== null) reveal(row);
  });

  function toggle(participant: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(participant)) next.delete(participant);
      else next.add(participant);
      return next;
    });
  }

  async function copyEmails() {
    const emails = table.missing.map((member) => member.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(
        `Copied ${table.missing.length} email${table.missing.length === 1 ? "" : "s"}`,
      );
    } catch {
      toast.error("Could not copy the emails.");
    }
  }

  function sortHead(
    sortKey: SortKey,
    label: string,
    column?: Column,
    className?: string,
  ) {
    const active = sort === sortKey;
    const filter =
      column !== undefined && answer !== null && answer.column === column.key
        ? answer
        : null;
    return (
      <th
        key={sortKey}
        aria-sort={active ? "ascending" : undefined}
        className={cn(HEAD, "border-b border-border px-3 py-2", className)}
      >
        <button
          type="button"
          onClick={() => setSort(sortKey)}
          className={cn(
            "-mx-1 inline-flex max-w-56 items-end gap-1 rounded-md px-1 text-start hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
            active && "text-foreground",
          )}
        >
          <span className="line-clamp-3" title={label}>
            {label}
          </span>
          {active ? (
            <ArrowUp aria-hidden className="mb-0.5 size-3.5 shrink-0" />
          ) : null}
        </button>
        {filter !== null ? (
          <button
            type="button"
            onClick={onClearAnswer}
            aria-label={`Show every answer to ${label}`}
            className="mt-1.5 flex max-w-56 items-center gap-1 rounded-md bg-foreground px-2 py-0.5 text-background text-xs"
          >
            <span className="truncate">{filter.value}</span>
            <X aria-hidden className="size-3 shrink-0" />
          </button>
        ) : null}
      </th>
    );
  }

  function nameCell(name: ReactNode, muted: boolean) {
    return (
      <td
        className={cn(
          STICKY_NAME,
          "border-b px-3 py-2.5 align-top whitespace-nowrap",
          muted ? "text-muted-foreground" : "font-medium",
        )}
      >
        {name}
      </td>
    );
  }

  function sectionCell(member: Member | null) {
    if (!showSection) return null;
    return (
      <td className="border-b border-border px-3 py-2.5 align-top text-muted-foreground whitespace-nowrap">
        {member ? sectionName(member.section ?? "") : ""}
      </td>
    );
  }

  function answerRow(row: AnswerRow, muted: boolean) {
    const long = row.cells.some((cells) =>
      cells.some(
        (cell) => cell.kind === "text" && cell.value.length > LONG_ANSWER,
      ),
    );
    const isOpen = open.has(row.participant);
    return (
      <tr
        key={row.participant}
        id={rowId(row.participant)}
        onClick={long ? () => toggle(row.participant) : undefined}
        className={cn("hover:[&>td]:bg-muted/40", long && "cursor-pointer")}
      >
        {nameCell(
          <span
            className="inline-flex items-baseline gap-2"
            title={row.member?.email}
          >
            <span dir="auto">{row.name}</span>
            {row.member && row.member.kind !== STUDENT ? (
              <Tag>{row.member.kind.toLowerCase()}</Tag>
            ) : null}
          </span>,
          muted,
        )}
        {sectionCell(row.member)}
        {row.cells.map((cells, index) => (
          <td
            key={columns[index]?.key ?? index}
            className="border-b border-border px-3 py-2.5 align-top"
          >
            <Cells cells={cells} open={isOpen} onJump={jump} />
          </td>
        ))}
      </tr>
    );
  }

  function memberRow(member: Member, by: ReactNode) {
    return (
      <tr key={member.user} id={rowId(member.user)}>
        {nameCell(
          <span dir="auto" title={member.email}>
            {memberName(member)}
          </span>,
          true,
        )}
        {sectionCell(member)}
        <td
          colSpan={columns.length}
          className="border-b border-border px-3 py-2.5 text-muted-foreground"
        >
          {by}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-3">
      {table.missing.length > 0 || table.unknown > 0 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          {table.missing.length > 0 ? (
            <span className="inline-flex items-center gap-1">
              <span className="font-semibold tabular-nums">
                {table.missing.length}
              </span>{" "}
              <span className="text-muted-foreground">not handed in</span>
              <button
                type="button"
                onClick={copyEmails}
                aria-label="Copy their emails"
                title="Copy their emails"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Copy className="size-3.5" />
              </button>
            </span>
          ) : null}
          {table.unknown > 0 ? (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                aria-pressed={unknownOnly}
                onClick={() => setUnknownOnly((on) => !on)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                  unknownOnly &&
                    "bg-foreground text-background hover:bg-foreground",
                )}
              >
                <CircleAlert
                  aria-hidden
                  className={cn("size-3.5", !unknownOnly && "text-destructive")}
                />
                <span className="font-semibold tabular-nums">
                  {table.unknown}
                </span>{" "}
                <span className={cn(!unknownOnly && "text-muted-foreground")}>
                  email{table.unknown === 1 ? "" : "s"} not on the roster
                </span>
              </button>
              <InlineHelp label="About emails in answers">
                <p>Emails on the roster show as names.</p>
                <p className="mt-1">
                  <CircleAlert
                    aria-hidden
                    className="me-1 inline size-3.5 align-text-bottom text-destructive"
                  />
                  Email not on the roster.
                </p>
              </InlineHelp>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="relative max-h-[75vh] overflow-auto rounded-xl border border-border bg-card">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {sortHead(
                "name",
                "Student",
                undefined,
                cn(STICKY_NAME, "z-30 bg-muted"),
              )}
              {showSection ? sortHead("section", "Section") : null}
              {columns.map((column) =>
                sortHead(column.key, columnLabel(column), column),
              )}
            </tr>
          </thead>
          <tbody>
            {answered.map((row) => answerRow(row, false))}
            {answered.length === 0 && filtering ? (
              <tr>
                <td
                  colSpan={span + 1}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No answers match.
                </td>
              </tr>
            ) : null}
            {!filtering && table.missing.length > 0 ? (
              <>
                <GroupRow
                  label="Not handed in"
                  count={table.missing.length}
                  span={span}
                />
                {table.missing.map((member) => memberRow(member, null))}
              </>
            ) : null}
            {!filtering && table.named.length > 0 ? (
              <>
                <GroupRow
                  label="Named by a classmate"
                  count={table.named.length}
                  span={span}
                />
                {table.named.map(({ member, by }) =>
                  memberRow(
                    member,
                    <>
                      Named by{" "}
                      {by.map((entry, index) => (
                        <span key={entry.participant}>
                          {index > 0 ? ", " : null}
                          <Jump to={entry.participant} onJump={jump}>
                            <span dir="auto">{entry.name}</span>
                          </Jump>
                        </span>
                      ))}
                    </>,
                  ),
                )}
              </>
            ) : null}
            {outside.length > 0 ? (
              <>
                <GroupRow
                  label="Answered but not on the roster"
                  count={outside.length}
                  span={span}
                />
                {outside.map((row) => answerRow(row, true))}
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

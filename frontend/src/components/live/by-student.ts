import { toCsv } from "@/lib/csv";

/** A roster member as `/roster/list` reads them. */
export interface Member {
  user: string;
  displayName: string | null;
  email: string;
  section: string | null;
  kind: string;
}

/** A question of the run's board, as much of it as the table reads. */
export interface BoardQuestion {
  question: string;
  prompt: string;
  choices: string[];
  parts: string[];
  cap: number;
  values: {
    response: string;
    participant: string;
    part: string;
    value: string;
  }[];
}

/**
 * One column of the table: a question, or one labeled part of one. A repeated
 * box is one column holding every repetition.
 */
export interface Column {
  key: string;
  prompt: string;
  /** The part this column holds, or "" for the whole question. */
  part: string;
  choices: string[];
  /** Most answers in this column are roster emails, so they show as names. */
  emails: boolean;
}

export type Cell =
  | { kind: "text"; value: string }
  | { kind: "choice"; value: string }
  /** A roster email, shown as that member's name. */
  | { kind: "person"; typed: string; member: Member }
  /** An answer in an email column that is no roster email. */
  | { kind: "unknown"; typed: string };

export interface AnswerRow {
  participant: string;
  /** The roster member who answered, or null for anyone not on the roster. */
  member: Member | null;
  name: string;
  /** Each column's answers, in the order they were handed in. */
  cells: Cell[][];
  unknown: number;
}

export interface NamedRow {
  member: Member;
  /** Everyone whose answer names this member, in table order. */
  by: { participant: string; name: string; member: Member | null }[];
}

export interface StudentTable {
  columns: Column[];
  /** Roster members who handed in. */
  answered: AnswerRow[];
  /** Students who did not hand in and whom no answer names. */
  missing: Member[];
  /** Students who did not hand in but whom someone's answer names. */
  named: NamedRow[];
  /** Answers from participants not on the roster. */
  outside: AnswerRow[];
  /** How many answers in email columns are no roster email. */
  unknown: number;
}

export const STUDENT = "STUDENT";

/** How an email is compared: trimmed and lower-cased, as the roster stores it. */
export function emailKey(text: string): string {
  return text.trim().toLowerCase();
}

export function memberName(member: Member): string {
  return member.displayName?.trim() || member.email;
}

function columnsOf(question: BoardQuestion): Column[] {
  const base = {
    prompt: question.prompt,
    choices: question.choices,
    emails: false,
  };
  if (question.parts.length === 0 || question.cap >= 2)
    return [{ ...base, key: question.question, part: "" }];
  return question.parts.map((part, index) => ({
    ...base,
    key: `${question.question}#${index + 1}`,
    part,
  }));
}

function columnOfValue(
  columns: Column[],
  question: BoardQuestion,
  part: string,
): number {
  const own = columns.filter(
    (column) =>
      column.key === question.question ||
      column.key.startsWith(`${question.question}#`),
  );
  const match = own.length === 1 ? own[0] : own.find((c) => c.part === part);
  return match === undefined ? -1 : columns.indexOf(match);
}

/**
 * The run's answers joined to the roster: one row per participant who handed
 * in, and the students who did not, split by whether an answer names them.
 * Model seats are left out.
 */
export function studentTable(
  questions: readonly BoardQuestion[],
  modelResponses: readonly { response: string }[],
  roster: readonly Member[],
): StudentTable {
  const seated = new Set(modelResponses.map((entry) => entry.response));
  const byUser = new Map(roster.map((member) => [member.user, member]));
  const byEmail = new Map(
    roster.map((member) => [emailKey(member.email), member]),
  );

  const columns = questions.flatMap(columnsOf);
  const order: string[] = [];
  const rowsOf = new Map<string, string[][]>();
  for (const question of questions) {
    for (const value of question.values) {
      if (seated.has(value.response)) continue;
      const index = columnOfValue(columns, question, value.part);
      if (index < 0) continue;
      let row = rowsOf.get(value.participant);
      if (row === undefined) {
        row = columns.map(() => []);
        rowsOf.set(value.participant, row);
        order.push(value.participant);
      }
      row[index]?.push(value.value);
    }
  }

  // A written column reads as emails when most of its answers are roster emails.
  for (const [index, column] of columns.entries()) {
    if (column.choices.length > 0) continue;
    const values = [...rowsOf.values()].flatMap((row) => row[index] ?? []);
    const matched = values.filter((value) => byEmail.has(emailKey(value)));
    column.emails = matched.length > 0 && matched.length * 2 >= values.length;
  }

  let unnamed = 0;
  let unknown = 0;
  const answered: AnswerRow[] = [];
  const outside: AnswerRow[] = [];
  for (const participant of order) {
    const values = rowsOf.get(participant) ?? [];
    const member = byUser.get(participant) ?? null;
    let misses = 0;
    const cells = columns.map((column, index): Cell[] =>
      (values[index] ?? []).map((value): Cell => {
        if (column.choices.length > 0) return { kind: "choice", value };
        if (!column.emails) return { kind: "text", value };
        const found = byEmail.get(emailKey(value));
        if (found) return { kind: "person", typed: value, member: found };
        misses += 1;
        return { kind: "unknown", typed: value };
      }),
    );
    unknown += misses;
    const row: AnswerRow = {
      participant,
      member,
      name: member ? memberName(member) : `Unnamed ${++unnamed}`,
      cells,
      unknown: misses,
    };
    (member ? answered : outside).push(row);
  }

  const handedIn = new Set(order);
  const namers = new Map<string, NamedRow["by"]>();
  for (const row of [...answered, ...outside]) {
    for (const cell of row.cells.flat()) {
      if (cell.kind !== "person" || cell.member.user === row.participant)
        continue;
      const list = namers.get(cell.member.user) ?? [];
      if (!list.some((entry) => entry.participant === row.participant))
        list.push({
          participant: row.participant,
          name: row.name,
          member: row.member,
        });
      namers.set(cell.member.user, list);
    }
  }

  const missing: Member[] = [];
  const named: NamedRow[] = [];
  for (const member of roster) {
    if (member.kind !== STUDENT || handedIn.has(member.user)) continue;
    const by = namers.get(member.user);
    if (by) named.push({ member, by });
    else missing.push(member);
  }
  const byName = (left: Member, right: Member) =>
    memberName(left).localeCompare(memberName(right));
  missing.sort(byName);
  named.sort((left, right) => byName(left.member, right.member));

  return { columns, answered, missing, named, outside, unknown };
}

/** Which column the rows are sorted by: the name, the section, or a column key. */
export type SortKey = "name" | "section" | string;

/** Only the rows giving this answer to this column. */
export interface AnswerFilter {
  column: string;
  value: string;
}

function cellSortText(cell: Cell | undefined): string {
  if (cell === undefined) return "";
  if (cell.kind === "person") return memberName(cell.member);
  if (cell.kind === "unknown") return cell.typed.trim();
  return cell.value;
}

/**
 * Rows in the chosen order, A to Z. A choice column sorts in the order the
 * choices were offered; an empty cell sorts last; ties fall back to the name.
 */
export function sortRows(
  rows: readonly AnswerRow[],
  columns: readonly Column[],
  key: SortKey,
  sectionName: (section: string) => string,
): AnswerRow[] {
  const byName = (left: AnswerRow, right: AnswerRow) =>
    left.name.localeCompare(right.name);
  if (key === "name") return [...rows].sort(byName);
  if (key === "section")
    return [...rows].sort(
      (left, right) =>
        sectionName(left.member?.section ?? "").localeCompare(
          sectionName(right.member?.section ?? ""),
        ) || byName(left, right),
    );
  const index = columns.findIndex((column) => column.key === key);
  const column = columns[index];
  if (column === undefined) return [...rows].sort(byName);
  const rank = (row: AnswerRow): [number, number, string] => {
    const cell = row.cells[index]?.[0];
    if (cell === undefined) return [1, 0, ""];
    const offered = column.choices.indexOf(cellSortText(cell));
    return [
      0,
      offered < 0 ? column.choices.length : offered,
      cellSortText(cell).toLocaleLowerCase(),
    ];
  };
  return [...rows].sort((left, right) => {
    const [emptyL, choiceL, textL] = rank(left);
    const [emptyR, choiceR, textR] = rank(right);
    return (
      emptyL - emptyR ||
      choiceL - choiceR ||
      textL.localeCompare(textR) ||
      byName(left, right)
    );
  });
}

export function filterRows(
  rows: readonly AnswerRow[],
  columns: readonly Column[],
  answer: AnswerFilter | null,
  unknownOnly: boolean,
): AnswerRow[] {
  const index =
    answer === null ? -1 : columns.findIndex((c) => c.key === answer.column);
  return rows.filter((row) => {
    if (unknownOnly && row.unknown === 0) return false;
    if (answer !== null) {
      const cells = row.cells[index] ?? [];
      if (!cells.some((cell) => cellSortText(cell) === answer.value))
        return false;
    }
    return true;
  });
}

export function columnLabel(column: Column): string {
  return column.part === ""
    ? column.prompt
    : `${column.prompt}: ${column.part}`;
}

function typedText(cell: Cell): string {
  return cell.kind === "text" || cell.kind === "choice"
    ? cell.value
    : cell.typed;
}

/**
 * The whole table as CSV, whatever the screen is filtered to: everyone who
 * handed in, then the students who did not, then answers from outside the
 * roster. Answers are written as typed.
 */
export function studentCsv(
  table: StudentTable,
  sectionName: (section: string) => string,
): string {
  const header = [
    "Name",
    "Email",
    "Section",
    "Status",
    "Named by",
    ...table.columns.map(columnLabel),
  ];
  const answers = (row: AnswerRow) =>
    row.cells.map((cells) => cells.map(typedText).join("; "));
  const blank = table.columns.map(() => "");
  const byName = (left: AnswerRow, right: AnswerRow) =>
    left.name.localeCompare(right.name);
  const rows = [
    header,
    ...[...table.answered]
      .sort(byName)
      .map((row) => [
        row.name,
        row.member?.email ?? "",
        sectionName(row.member?.section ?? ""),
        "Handed in",
        "",
        ...answers(row),
      ]),
    ...table.named.map(({ member, by }) => [
      memberName(member),
      member.email,
      sectionName(member.section ?? ""),
      "Not handed in",
      by.map((entry) => entry.name).join("; "),
      ...blank,
    ]),
    ...table.missing.map((member) => [
      memberName(member),
      member.email,
      sectionName(member.section ?? ""),
      "Not handed in",
      "",
      ...blank,
    ]),
    ...table.outside.map((row) => [
      row.name,
      "",
      "",
      "Not on the roster",
      "",
      ...answers(row),
    ]),
  ];
  return toCsv(rows);
}

/** The lens is offered once a roster member has handed in. */
export function offersByStudent(table: StudentTable): boolean {
  return table.answered.length > 0;
}

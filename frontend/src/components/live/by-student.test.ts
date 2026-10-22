import { describe, expect, test } from "bun:test";
import {
  type BoardQuestion,
  filterRows,
  type Member,
  sortRows,
  studentCsv,
  studentTable,
} from "./by-student";

const member = (
  user: string,
  name: string,
  section = "s1",
  kind = "STUDENT",
): Member => ({
  user,
  displayName: name,
  email: `${user}@mit.edu`,
  section,
  kind,
});

const ROSTER = [
  member("ava", "Ava Chen"),
  member("ben", "Ben Okafor"),
  member("cara", "Cara Ruiz", "s2"),
  member("dev", "Dev Patel", "s2"),
  member("eli", "Eli Stone"),
  member("tess", "Tess Lin", "", "STAFF"),
];

const value = (participant: string, text: string, part = "") => ({
  response: `r-${participant}`,
  participant,
  part,
  value: text,
});

const TEAM: BoardQuestion = {
  question: "q1",
  prompt: "Are you answering for a team?",
  choices: ["Yes", "Partly", "No, place me"],
  parts: [],
  cap: 0,
  values: [
    value("ava", "Yes"),
    value("dev", "No, place me"),
    value("phone-1", "Partly"),
    value("seat-1", "Yes"),
  ],
};

const MATE: BoardQuestion = {
  question: "q2",
  prompt: "Teammate's MIT email",
  choices: [],
  parts: [],
  cap: 0,
  values: [
    value("ava", " BEN@mit.edu "),
    value("phone-1", "ben@mit.edu"),
    value("dev", "zed@gmail.com"),
  ],
};

const NOTE: BoardQuestion = {
  question: "q3",
  prompt: "Anything else?",
  choices: [],
  parts: [],
  cap: 0,
  values: [
    value("ava", "cara@mit.edu"),
    value("dev", "Happy to lead."),
    value("tess", "test"),
  ],
};

const SEATS = [{ response: "r-seat-1" }];
const sectionName = (section: string) =>
  ({ s1: "R01", s2: "R02" })[section] ?? "";

describe("joining answers to the roster", () => {
  const table = studentTable([TEAM, MATE, NOTE], SEATS, ROSTER);

  test("keeps one row per roster member who handed in, and leaves out model seats", () => {
    expect(table.answered.map((row) => row.name)).toEqual([
      "Ava Chen",
      "Dev Patel",
      "Tess Lin",
    ]);
    expect(table.outside.map((row) => row.name)).toEqual(["Unnamed 1"]);
  });

  test("shows a roster email as its member, ignoring case and space", () => {
    const ava = table.answered[0];
    expect(ava?.cells[1]).toEqual([
      { kind: "person", typed: " BEN@mit.edu ", member: ROSTER[1] as Member },
    ]);
  });

  test("marks an answer in an email column that is no roster email", () => {
    const dev = table.answered[1];
    expect(dev?.cells[1]).toEqual([
      { kind: "unknown", typed: "zed@gmail.com" },
    ]);
    expect(dev?.unknown).toBe(1);
    expect(table.unknown).toBe(1);
  });

  test("leaves a column as text when most of its answers are not roster emails", () => {
    expect(table.columns[2]?.emails).toBe(false);
    expect(table.answered[0]?.cells[2]).toEqual([
      { kind: "text", value: "cara@mit.edu" },
    ]);
  });

  test("splits students who did not hand in by whether an answer names them", () => {
    expect(table.named.map((row) => row.member.user)).toEqual(["ben"]);
    expect(table.named[0]?.by.map((entry) => entry.name)).toEqual([
      "Ava Chen",
      "Unnamed 1",
    ]);
    expect(table.missing.map((row) => row.user)).toEqual(["cara", "eli"]);
  });

  test("never counts staff as missing", () => {
    expect(table.missing.some((row) => row.kind !== "STUDENT")).toBe(false);
  });

  test("does not count naming yourself", () => {
    const self = studentTable(
      [
        {
          ...MATE,
          values: [value("eli", "eli@mit.edu"), value("ava", "ben@mit.edu")],
        },
      ],
      [],
      ROSTER,
    );
    expect(self.named.map((row) => row.member.user)).toEqual(["ben"]);
  });
});

describe("questions answered in pieces", () => {
  test("gives each labeled part a column of its own", () => {
    const labeled: BoardQuestion = {
      question: "q9",
      prompt: "Three words",
      choices: [],
      parts: ["one", "two"],
      cap: 0,
      values: [value("ava", "red", "one"), value("ava", "blue", "two")],
    };
    const table = studentTable([labeled], [], ROSTER);
    expect(table.columns.map((column) => column.key)).toEqual(["q9#1", "q9#2"]);
    expect(table.answered[0]?.cells.map((cells) => cells.length)).toEqual([
      1, 1,
    ]);
  });

  test("holds every repetition of a repeated box in one column", () => {
    const repeated: BoardQuestion = {
      question: "q8",
      prompt: "When can you meet?",
      choices: [],
      parts: ["Time"],
      cap: 3,
      values: [value("ava", "Mon", "Time"), value("ava", "Thu", "Time")],
    };
    const table = studentTable([repeated], [], ROSTER);
    expect(table.columns).toHaveLength(1);
    expect(table.answered[0]?.cells[0]).toHaveLength(2);
  });
});

describe("ordering and narrowing rows", () => {
  const table = studentTable([TEAM, MATE, NOTE], SEATS, ROSTER);

  test("sorts a choice column in the order the choices were offered, empty last", () => {
    const sorted = sortRows(table.answered, table.columns, "q1", sectionName);
    expect(sorted.map((row) => row.name)).toEqual([
      "Ava Chen",
      "Dev Patel",
      "Tess Lin",
    ]);
  });

  test("sorts by section, then name", () => {
    const sorted = sortRows(
      table.answered,
      table.columns,
      "section",
      sectionName,
    );
    expect(sorted.map((row) => row.name)).toEqual([
      "Tess Lin",
      "Ava Chen",
      "Dev Patel",
    ]);
  });

  test("keeps only the rows giving one answer", () => {
    const rows = filterRows(
      table.answered,
      table.columns,
      { column: "q1", value: "No, place me" },
      false,
    );
    expect(rows.map((row) => row.name)).toEqual(["Dev Patel"]);
  });

  test("keeps only the rows holding an email not on the roster", () => {
    const rows = filterRows(table.answered, table.columns, null, true);
    expect(rows.map((row) => row.name)).toEqual(["Dev Patel"]);
  });
});

describe("the CSV", () => {
  const table = studentTable([TEAM, MATE, NOTE], SEATS, ROSTER);
  const lines = studentCsv(table, sectionName).trimEnd().split("\r\n");

  test("names the columns, then each question", () => {
    expect(lines[0]).toBe(
      "Name,Email,Section,Status,Named by,Are you answering for a team?,Teammate's MIT email,Anything else?",
    );
  });

  test("writes answers as typed and lists everyone on the roster", () => {
    expect(lines).toContain(
      "Ava Chen,ava@mit.edu,R01,Handed in,,Yes, BEN@mit.edu ,cara@mit.edu",
    );
    expect(lines).toContain(
      "Ben Okafor,ben@mit.edu,R01,Not handed in,Ava Chen; Unnamed 1,,,",
    );
    expect(lines).toContain("Eli Stone,eli@mit.edu,R01,Not handed in,,,,");
    expect(lines).toContain(
      "Unnamed 1,,,Not on the roster,,Partly,ben@mit.edu,",
    );
  });
});

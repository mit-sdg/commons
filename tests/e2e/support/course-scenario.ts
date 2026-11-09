import { invitationCredential } from "../../../src/concepts/inviting/credential.ts";
import {
  type CourseGradeInputs,
  type CoursePolicy,
  courseGrades,
} from "../../../src/computations/course-grades.ts";
import {
  lectureAttendance,
  lectureDate,
  type LectureRun,
} from "../../../src/computations/lectures.ts";
import {
  EVIDENCE,
  type Level,
  MODEL,
  type Rating,
  SEPARATION,
  type StandardText,
} from "./grade-scenarios.ts";

/**
 * Seeds a whole course so far into a running Commons stack, for rehearsing
 * late days, lecture attendance, and course grades together: a configured
 * class with sections and students, four kinds of account, skills, six
 * assignments, late days, live runs marked as lectures, and a final policy
 * released to students. Every action goes through the API paths a browser
 * calls, in one of two ways.
 *
 * **Over HTTP** (`seedCourseScenario`), the server stamps every action with
 * its own clock, so two things can't be backdated:
 *
 * - **Submissions.** A paper handed in during seeding is handed in now. To
 *   make most papers on time, each past assignment is published due in the
 *   future, its on-time papers are handed in, and then its due date is
 *   revised to that moment. Late papers follow, a minute or so late. So every
 *   past due date falls inside the seeding run, in term order.
 * - **Live runs.** A run opens now, so every run falls on today's date and
 *   the attendance grid shows one lecture holding every marked run.
 *
 * **On a moved clock** (`seedCourseScenarioOnClock`), the seed builds its own
 * edge in process over the stack's database, with a clock it sets to each
 * moment of a term so far: about eleven weeks, due dates from ten weeks back
 * to a few days ago and one still to come, papers handed in around their due
 * dates (some one to three days late on late days), grading days after each
 * due date, eleven lectures two a week, and a policy whose attendance rule
 * caps a few students. The running stack reads what it wrote from the
 * database, so its pages show the term.
 *
 * It is meant for a fresh stack: Commons has one class, so a second seeding
 * adds a second set of students to the same roster.
 */

const PASSWORD = "password123";
const CONCURRENCY = 10;
const DAY = 86_400_000;

// ---------------------------------------------------------------- transport

interface Session {
  user: string;
  cookie: string;
  /** Who to sign in again as when the session has lapsed. */
  username?: string;
}

/** Where a request goes: the network, or an edge in this process. */
type Transport = (request: Request) => Promise<Response>;

class Api {
  calls = 0;
  constructor(
    readonly origin: string,
    readonly transport: Transport = (request) => fetch(request),
  ) {}

  async post<T>(cookie: string | null, path: string, data: unknown) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        this.calls += 1;
        response = await this.transport(
          new Request(`${this.origin}/api${path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(cookie ? { Cookie: cookie } : {}),
            },
            body: JSON.stringify(data),
          }),
        );
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
        continue;
      }
      const text = await response.text();
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error(`${path}: HTTP ${response.status} ${text.slice(0, 200)}`);
      }
      if (!response.ok || (body !== null && typeof body === "object" && "error" in body))
        throw new Error(`${path}: HTTP ${response.status} ${text.slice(0, 400)}`);
      const setCookie = response.headers.get("set-cookie")?.split(";")[0] ?? null;
      return { body: body as T, setCookie, bytes: text.length };
    }
    throw new Error(`${path}: ${lastError instanceof Error ? lastError.message : lastError}`);
  }

  async call<T>(session: Session, path: string, data: unknown = {}): Promise<T> {
    try {
      return (await this.post<T>(session.cookie, path, data)).body;
    } catch (error) {
      // A session lapses after three idle days, which a moved clock passes
      // between one student's actions; sign in again and retry once.
      if (!session.username || !(error instanceof Error) || !error.message.includes("HTTP 401"))
        throw error;
      session.cookie = (await this.login(session.username)).cookie;
      return (await this.post<T>(session.cookie, path, data)).body;
    }
  }

  async login(username: string, password = PASSWORD): Promise<Session> {
    const { body, setCookie } = await this.post<{ user: string }>(null, "/auth/login", {
      username,
      password,
    });
    if (!setCookie) throw new Error(`No session cookie for ${username}`);
    return { user: body.user, cookie: setCookie, username };
  }
}

async function pool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index] as T, index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return results;
}

/** Deterministic randomness, so the course has the same shape on every seeding. */
function random(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// ---------------------------------------------------------------- people

const FIRST = [
  "Amina",
  "Noor",
  "Mateo",
  "Priya",
  "Kwame",
  "Lena",
  "Hiroshi",
  "Sofia",
  "Tomasz",
  "Aisha",
  "Diego",
  "Mei",
  "Oluwaseun",
  "Hannah",
  "Rafael",
  "Ines",
  "Yusuf",
  "Chloe",
  "Arjun",
  "Freya",
  "Emeka",
  "Lucia",
  "Kenji",
  "Zara",
  "Mikhail",
  "Talia",
  "Santiago",
  "Ayesha",
  "Jonas",
  "Nadia",
  "Kofi",
  "Elena",
  "Ravi",
  "Maya",
  "Bilal",
  "Ingrid",
  "Tariq",
  "Camila",
  "Owen",
  "Leila",
  "Daniel",
  "Grace",
  "Wei",
  "Fatima",
  "Lucas",
  "Anika",
  "Ethan",
  "Sakura",
  "Omar",
  "Julia",
  "Nikhil",
  "Esther",
  "Marcus",
  "Yara",
  "Benjamin",
  "Thandiwe",
  "Felix",
  "Ana",
  "Samuel",
  "Rin",
];
const LAST = [
  "Okafor",
  "Haddad",
  "Alvarez",
  "Raman",
  "Mensah",
  "Fischer",
  "Tanaka",
  "Rossi",
  "Nowak",
  "Rahman",
  "Herrera",
  "Zhang",
  "Adeyemi",
  "Schmidt",
  "Costa",
  "Moreau",
  "Demir",
  "Dubois",
  "Iyer",
  "Larsen",
  "Eze",
  "Romero",
  "Watanabe",
  "Hussain",
  "Volkov",
  "Cohen",
  "Castillo",
  "Siddiqui",
  "Berg",
  "Petrova",
  "Boateng",
  "Popescu",
  "Krishnan",
  "Levy",
  "Qureshi",
  "Johansson",
  "Farouk",
  "Ortiz",
  "Gallagher",
  "Karimi",
  "Kim",
  "Nguyen",
  "Chen",
  "Park",
  "Silva",
  "Patel",
  "Murphy",
  "Sato",
  "Ali",
  "Becker",
  "Sharma",
  "Mwangi",
  "Lopez",
  "Hassan",
  "Weber",
  "Ndlovu",
  "Wagner",
  "Santos",
  "Brown",
  "Yamamoto",
];

function studentNames(count: number): { first: string; last: string }[] {
  const names: { first: string; last: string }[] = [];
  const seen = new Set<string>();
  for (let index = 0; names.length < count; index += 1) {
    const first = FIRST[index % FIRST.length] as string;
    const last = LAST[(index * 7 + Math.floor(index / FIRST.length)) % LAST.length] as string;
    const key = `${first} ${last}`;
    if (seen.has(key)) continue;
    seen.add(key);
    names.push({ first, last });
  }
  return names;
}

function handle(parts: string[], tag: string): string {
  const base = parts
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  return `${base.slice(0, 31 - tag.length - 1)}_${tag}`;
}

interface Person extends Session {
  name: string;
  username: string;
  email: string;
}

async function createPerson(api: Api, admin: Session, name: string, tag: string, domain: string) {
  const [first = name, ...rest] = name.split(" ");
  const last = rest.join(" ") || "x";
  const username = handle([first, last], tag);
  const email = `${first}.${last.replace(/\s/g, "")}.${tag}@${domain}`.toLowerCase();
  const { invitation } = await api.call<{ invitation: string }>(admin, "/invitations/invite", {
    email,
  });
  const accepted = await api.post<{ user: string }>(null, "/auth/accept-invitation", {
    invitation,
    temporaryPassword: invitationCredential(invitation),
    username,
    password: PASSWORD,
    displayName: name,
  });
  const session = accepted.setCookie
    ? { user: accepted.body.user, cookie: accepted.setCookie }
    : await api.login(username);
  return { ...session, name, username, email } satisfies Person;
}

async function ensureRole(api: Api, admin: Session, name: string, capabilities: string[]) {
  const find = async () =>
    (
      await api.call<{ roles: { role: string; name: string }[] }>(admin, "/roles/list", {})
    ).roles.find((role) => role.name === name)?.role;
  const existing = await find();
  if (existing) return existing;
  try {
    return (await api.call<{ role: string }>(admin, "/roles/define", { name, capabilities })).role;
  } catch (error) {
    const again = await find();
    if (again) return again;
    throw error;
  }
}

// ---------------------------------------------------------------- the course

const FRAMING: StandardText = {
  name: "Problem framing",
  description: "Says whose problem the design solves and why it matters to them.",
  deficient: "No problem is stated, or it restates the assignment.",
  emergent: "States a problem but not whose it is or why it matters.",
  competent: "States a real problem for named people, grounded in what they said.",
  expert: "Frames the problem so the design follows, and says what was ruled out.",
};
const WRITING: StandardText = {
  name: "Technical writing",
  description: "Writes so a reader can follow and check the design.",
  deficient: "Hard to follow; key terms are undefined.",
  emergent: "Mostly clear, with gaps a reader must fill in.",
  competent: "Clear, organized, and precise about each concept.",
  expert: "Clear and economical; a reader could rebuild the design from it.",
};
const IMPLEMENTATION: StandardText = {
  name: "Implementation",
  description: "Builds the concepts and syncs so they behave as specified.",
  deficient: "The build does not run or does not match the design.",
  emergent: "Runs, but some actions don't behave as the specification says.",
  competent: "Each concept and sync behaves as specified.",
  expert: "Behaves as specified, with tests that show the operational principles.",
};

/** The course's skills, in the order the term first rates them. */
const SKILLS = [FRAMING, MODEL, WRITING, EVIDENCE, SEPARATION, IMPLEMENTATION];

type Method = "COMPETENCY" | "POINTS";

interface AssignmentPlan {
  key: string;
  title: string;
  kind: "EXERCISE" | "PERSONAL_PROJECT" | "FINAL_PROJECT";
  instructions: string;
  method: Method;
  /** Skills by name, for a competency rubric. */
  skills: string[];
  /** Criteria for a points setup. */
  points: { name: string; maxPoints: number }[];
  /** Days into the term it opened, and days from now it is due when not yet due. */
  opensDaysAgo: number;
  dueInDays: number | null;
  /** How often, out of 1, a handed-in paper is still a draft or not graded yet. */
  draftShare: number;
  ungradedShare: number;
  /** The skill weights the course guide gives this assignment. */
  weights: Record<string, number>;
}

const ASSIGNMENTS: AssignmentPlan[] = [
  {
    key: "ex1",
    title: "Exercise 1: Concept critique",
    kind: "EXERCISE",
    instructions:
      "Pick an app you use every day and critique one of its concepts: its purpose, state, actions, and operational principle, and where it fails its users.",
    method: "COMPETENCY",
    skills: [FRAMING.name, MODEL.name, WRITING.name],
    points: [],
    opensDaysAgo: 62,
    dueInDays: null,
    draftShare: 0,
    ungradedShare: 0,
    weights: { [FRAMING.name]: 3, [MODEL.name]: 1, [WRITING.name]: 1 },
  },
  {
    key: "ex2",
    title: "Exercise 2: Concept design",
    kind: "EXERCISE",
    instructions:
      "Design two concepts for a reservation app from your interviews, and argue from the interviews why each concept earns its place.",
    method: "COMPETENCY",
    skills: [MODEL.name, EVIDENCE.name, WRITING.name],
    points: [],
    opensDaysAgo: 48,
    dueInDays: null,
    draftShare: 0,
    ungradedShare: 0,
    weights: {},
  },
  {
    key: "ex3",
    title: "Exercise 3: Data modeling",
    kind: "EXERCISE",
    instructions:
      "Turn your two concepts into collections and queries. Points for a schema that holds the state and for queries that answer each action's needs.",
    method: "POINTS",
    skills: [],
    points: [
      { name: "Schema", maxPoints: 6 },
      { name: "Queries", maxPoints: 4 },
    ],
    opensDaysAgo: 38,
    dueInDays: null,
    draftShare: 0,
    ungradedShare: 0,
    weights: {},
  },
  {
    key: "pp",
    title: "Personal project",
    kind: "PERSONAL_PROJECT",
    instructions:
      "Design, build, and deploy a small app of your own from three to five concepts, with a design document, the implementation, and a reflection.",
    method: "COMPETENCY",
    skills: [FRAMING.name, MODEL.name, SEPARATION.name, IMPLEMENTATION.name, WRITING.name],
    points: [],
    opensDaysAgo: 30,
    dueInDays: null,
    draftShare: 0.02,
    ungradedShare: 0,
    weights: {},
  },
  {
    key: "fp1",
    title: "Final project: Proposal",
    kind: "FINAL_PROJECT",
    instructions:
      "With your team, propose a final project: the problem, the people who have it, the evidence you have so far, and a first cut at the concepts.",
    method: "COMPETENCY",
    skills: [FRAMING.name, EVIDENCE.name, WRITING.name],
    points: [],
    opensDaysAgo: 14,
    dueInDays: null,
    draftShare: 0.05,
    ungradedShare: 0.07,
    weights: {},
  },
  {
    key: "fp2",
    title: "Final project: Beta",
    kind: "FINAL_PROJECT",
    instructions:
      "Deploy a beta of your team's app with every concept working end to end, and a short report on what your first users did with it.",
    method: "COMPETENCY",
    skills: [MODEL.name, SEPARATION.name, IMPLEMENTATION.name],
    points: [],
    opensDaysAgo: 4,
    dueInDays: 16,
    draftShare: 0,
    ungradedShare: 0,
    weights: {},
  },
];

const SECTIONS = [
  { name: "Recitation 1", location: "34-301", meetingPattern: "Mon/Wed 10:00" },
  { name: "Recitation 2", location: "4-153", meetingPattern: "Mon/Wed 13:00" },
  { name: "Recitation 3", location: "36-155", meetingPattern: "Tue/Thu 11:00" },
];
/** How the class spreads over the sections. */
const SECTION_SHARES = [0.4, 0.35, 0.25];

const LEVELS: Level[] = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"];
const BASE: [Level, number][] = [
  ["DEFICIENT", 0.07],
  ["EMERGENT", 0.33],
  ["COMPETENT", 0.43],
  ["EXPERT", 0.17],
];

function weighted(weights: [Level, number][], next: () => number): Level {
  let roll = next();
  for (const [level, weight] of weights) {
    if (roll < weight) return level;
    roll -= weight;
  }
  return (weights.at(-1) as [Level, number])[0];
}

function shift(level: Level, by: number): Level {
  return LEVELS[Math.max(0, Math.min(3, LEVELS.indexOf(level) + by))] as Level;
}

const FEEDBACK: Record<Level, string[]> = {
  DEFICIENT: [
    "This part is missing the core of what the rubric asks for; come to office hours and we'll work through it.",
    "I couldn't find this in the submission. Start from the purpose and work down.",
  ],
  EMERGENT: [
    "A start, but the reasoning stops short. Say why, not just what.",
    "The pieces are here; connect them to the purpose so a reader can check them.",
    "Close. Tie each claim to something you observed.",
  ],
  COMPETENT: [
    "Solid and clear; this does what the rubric asks.",
    "Well argued. A sharper example would make it stronger still.",
    "Good work: each claim is supported and easy to follow.",
  ],
  EXPERT: [
    "Excellent. You considered the alternative and said why yours wins.",
    "This is a model answer; I'd like to share it with the class if you agree.",
  ],
};

// ---------------------------------------------------------------- the plan

/** How a student handed in one assignment. */
export type Hand =
  | "on-time"
  | "late-covered"
  | "late-uncovered"
  | "extension"
  | "missing"
  | "excused"
  | "early"
  | "not-yet";
/** Where a handed-in paper stands with its graders. */
export type Mark = "released" | "draft" | "ungraded";

interface WorkPlan {
  hand: Hand;
  mark: Mark;
  /** Who grades it: an index into the staff list, or "enrolled" for the enrolled grader. */
  grader: "manager" | "grader" | "enrolled";
  marks: (Rating | number)[];
}

interface StudentPlan {
  strength: number;
  /** Chance of joining each live run. */
  presence: number;
  work: Record<string, WorkPlan>;
}

/** The plain student and the enrolled grader, by roster index. */
const PLAIN = 0;
const ENROLLED = 1;
/** The classmates the enrolled grader grades on Exercise 2: one released, one draft, one waiting. */
const DELEGATED_TO_ENROLLED = [2, 3, 4];
const EXCUSED = { student: 5, assignment: "pp" };
const EXTENSION = { student: 9, assignment: "pp" };
const OVERRIDE = {
  student: 7,
  value: "B",
  reason: "Led the team's proposal and interviews; agreed at the grading meeting.",
};
const EARLY_BETA = [6, 11];

function planStudents(count: number): StudentPlan[] {
  const next = random("course-scenario");
  return Array.from({ length: count }, (_, index) => {
    const roll = next();
    const strength = index === PLAIN ? 1 : roll < 0.15 ? -1 : roll < 0.8 ? 0 : 1;
    const presenceRoll = next();
    const presence =
      index === PLAIN || index === ENROLLED
        ? 0.95
        : presenceRoll < 0.07
          ? 0
          : presenceRoll < 0.22
            ? 0.45
            : 0.92;
    const work: Record<string, WorkPlan> = {};
    for (const assignment of ASSIGNMENTS) {
      const grader: WorkPlan["grader"] = "manager";
      const marks: (Rating | number)[] =
        assignment.method === "POINTS"
          ? assignment.points.map((criterion) => {
              const share = Math.min(
                1,
                Math.max(0.2, 0.72 + strength * 0.12 + (next() - 0.5) * 0.4),
              );
              return Math.round(share * criterion.maxPoints * 2) / 2;
            })
          : assignment.skills.map(() => {
              const level = weighted(BASE, next);
              const moved = next() < 0.5 ? shift(level, strength) : level;
              return index === PLAIN && moved === "DEFICIENT" ? "COMPETENT" : moved;
            });
      let hand: Hand;
      if (assignment.dueInDays !== null) hand = "not-yet";
      else {
        const handRoll = next();
        hand =
          handRoll < 0.035
            ? "missing"
            : handRoll < 0.085
              ? "late-covered"
              : handRoll < 0.12
                ? "late-uncovered"
                : "on-time";
      }
      const markRoll = next();
      const mark: Mark =
        markRoll < assignment.ungradedShare
          ? "ungraded"
          : markRoll < assignment.ungradedShare + assignment.draftShare
            ? "draft"
            : "released";
      work[assignment.key] = { hand, mark, grader, marks };
    }
    return { strength, presence, work };
  });
}

/** The fixed stories a rehearsal looks for, laid over the random plan. */
function fixStories(plans: StudentPlan[]) {
  const set = (index: number, key: string, patch: Partial<WorkPlan>) => {
    const plan = plans[index];
    if (plan) Object.assign(plan.work[key] as WorkPlan, patch);
  };
  // The plain student: one on time, one late on a late day, one late without.
  for (const key of ["ex1", "pp", "fp1"]) set(PLAIN, key, { hand: "on-time", mark: "released" });
  set(PLAIN, "ex2", { hand: "late-covered", mark: "released" });
  set(PLAIN, "ex3", { hand: "late-uncovered", mark: "released" });
  for (const key of ["ex1", "ex2", "ex3", "pp", "fp1"])
    set(ENROLLED, key, { hand: "on-time", mark: "released" });
  const [released, draft, waiting] = DELEGATED_TO_ENROLLED;
  for (const [index, mark] of [
    [released, "released"],
    [draft, "draft"],
    [waiting, "ungraded"],
  ] as const)
    if (index !== undefined) set(index, "ex2", { hand: "on-time", mark, grader: "enrolled" });
  set(EXCUSED.student, EXCUSED.assignment, { hand: "excused", mark: "released" });
  set(EXTENSION.student, EXTENSION.assignment, { hand: "extension", mark: "released" });
  for (const index of EARLY_BETA) set(index, "fp2", { hand: "early", mark: "ungraded" });
}

// ---------------------------------------------------------------- what the seed returns

export interface SeededAccount {
  user: string;
  name: string;
  username: string;
  password: string;
  email: string;
}

export interface SeededStudent extends SeededAccount {
  section: string;
  sectionName: string;
  /** How this student handed in each assignment, by assignment id. */
  work: Record<string, { hand: Hand; mark: Mark | null }>;
  /** The late days this student applied, by assignment id. */
  lateDays: { assignment: string; days: number }[];
  lecturesJoined: number;
}

export interface SeededCourse {
  tag: string;
  origin: string;
  password: string;
  /**
   * Whose clock stamped the actions: the stack's own ("server", over HTTP) or
   * the seed's, moved through a term so far ("moved").
   */
  clock: "server" | "moved";
  /** The first and last moments the seed's actions were stamped with. */
  term: { from: string; to: string };
  class: { code: string; title: string; term: string; timezone: string };
  sections: { section: string; name: string; students: number }[];
  accounts: {
    admin: { username: string; password: string; capabilities: string[] };
    manager: SeededAccount & { role: string; capabilities: string[] };
    grader: SeededAccount & { role: string; capabilities: string[] };
    enrolledGrader: SeededAccount & {
      role: string;
      capabilities: string[];
      section: string;
      delegated: { assignment: string; learners: string[] }[];
    };
    student: SeededAccount & { section: string; stories: Record<string, string> };
  };
  standards: { standard: string; edition: string; name: string }[];
  assignments: {
    assignment: string;
    key: string;
    title: string;
    kind: string;
    method: Method;
    availableAt: string;
    dueAt: string;
    path: string;
    counts: Record<string, number>;
  }[];
  lateDays: {
    defaultDays: number;
    maxDaysPerItem: number;
    unitHours: number;
    uses: number;
    /** The days those uses add up to. */
    days: number;
    extension: { assignment: string; student: string; dueAt: string };
  };
  lectures: {
    /** The latest lecture date, in the class's time zone. */
    date: string;
    /** Every lecture date, in order. */
    dates: string[];
    runs: {
      run: string;
      title: string;
      kind: string;
      lecture: boolean;
      joined: number;
      openedAt: string;
      date: string;
    }[];
  };
  coursePolicy: {
    policy: string;
    name: string;
    version: number;
    final: boolean;
    attendance: { key: string; below: number; atMost: string }[];
    override: { student: string; value: string; reason: string };
  } | null;
  release: {
    release: string;
    dueBy: string;
    held: number;
    released: number;
    /** Usernames whose grade the attendance rule lowered, as the seed computed it. */
    capped: string[];
  } | null;
  students: SeededStudent[];
  notes: string[];
  calls: number;
}

// ---------------------------------------------------------------- seeding

interface StandardEdition {
  standard: string;
  edition: string;
  name: string;
}

async function defineStandards(api: Api, admin: Session): Promise<StandardEdition[]> {
  const existing = async () =>
    (
      await api.call<{ standards: { standard: string; edition: string; name: string }[] }>(
        admin,
        "/grades/standards",
      )
    ).standards;
  return pool(SKILLS, CONCURRENCY, async (text) => {
    try {
      const defined = await api.call<{ standard: string; edition: string }>(
        admin,
        "/grades/define-standard",
        { ...text, referenceUrl: "" },
      );
      return { ...defined, name: text.name };
    } catch (error) {
      const found = (await existing()).find((entry) => entry.name === text.name);
      if (!found) throw error;
      return { standard: found.standard, edition: found.edition, name: text.name };
    }
  });
}

interface ConfiguredCriterion {
  criterion: string;
  basis: string | null;
  name: string | null;
  maxPoints: number | null;
  position: number;
}

interface Setup {
  revision: number;
  method: Method;
  criteria: { criterion: string }[];
}

async function configureSetup(
  api: Api,
  admin: Session,
  assignment: string,
  plan: AssignmentPlan,
  standards: StandardEdition[],
): Promise<Setup> {
  const criteria =
    plan.method === "POINTS"
      ? plan.points.map((entry, position) => ({
          kind: "POINTS",
          name: entry.name,
          maxPoints: entry.maxPoints,
          position,
        }))
      : plan.skills.map((name, position) => {
          const standard = standards.find((entry) => entry.name === name);
          if (!standard) throw new Error(`No standard named ${name}`);
          return { kind: "COMPETENCY", basis: standard.edition, position };
        });
  const configured = await api.call<{ revision: number; criteria: ConfiguredCriterion[] }>(
    admin,
    "/grades/configure-setup",
    { item: assignment, method: plan.method, revision: 0, criteria },
  );
  const ordered = configured.criteria.slice().sort((left, right) => left.position - right.position);
  return { revision: configured.revision, method: plan.method, criteria: ordered };
}

interface Course {
  api: Api;
  admin: Session;
  tag: string;
  students: Person[];
  plans: StudentPlan[];
  manager: Person;
  grader: Person;
  assignments: Map<
    string,
    { id: string; plan: AssignmentPlan; setup: Setup; draft: Record<string, unknown> }
  >;
  submissions: Map<string, string>;
  notes: string[];
}

/** A course with its class, people, late-day terms, and skills in place. */
interface StartedCourse extends Course {
  sections: { section: string; name: string }[];
  placement: Map<number, { section: string; name: string }>;
  managerRole: string;
  graderRole: string;
  enrolled: Person;
  standards: StandardEdition[];
}

const workKey = (assignment: string, student: string) => `${assignment}:${student}`;

async function submit(course: Course, key: string, index: number, revised = false) {
  const entry = course.assignments.get(key);
  const student = course.students[index];
  if (!entry || !student) return;
  const content = revised
    ? `${student.name}: ${entry.plan.title}, handed in after the deadline.`
    : `${student.name}: ${entry.plan.title}. My answer starts from the interviews and works through each concept's purpose, state, and actions.`;
  const { submission } = await course.api.call<{ submission: string }>(
    student,
    "/assignments/submit",
    { assignment: entry.id, content },
  );
  course.submissions.set(workKey(entry.id, student.user), submission);
}

async function gradeWork(course: Course, key: string, index: number, enrolled: Person) {
  const entry = course.assignments.get(key);
  const student = course.students[index];
  const plan = course.plans[index]?.work[key];
  if (!entry || !student || !plan) return;
  if (plan.hand === "missing" || plan.hand === "not-yet") return;
  if (plan.hand !== "excused" && plan.mark === "ungraded") return;
  const grader =
    plan.grader === "enrolled"
      ? enrolled
      : plan.grader === "grader"
        ? course.grader
        : course.manager;
  const evidence =
    plan.hand === "excused" ? "" : (course.submissions.get(workKey(entry.id, student.user)) ?? "");
  const recorded = await course.api.call<{ grade: string; version: number }>(
    grader,
    "/grades/record",
    { learner: student.user, item: entry.id, evidence, revision: entry.setup.revision },
  );
  if (plan.hand === "excused") {
    await course.api.call(grader, "/grades/excuse", {
      grade: recorded.grade,
      version: recorded.version,
      feedback: "Excused: documented medical absence during the project weeks.",
    });
    return;
  }
  const next = random(`${key}:${index}`);
  const judgments = entry.setup.criteria.map((criterion, position) => {
    const mark = plan.marks[position];
    return entry.setup.method === "POINTS"
      ? { kind: "POINTS", criterion: criterion.criterion, score: mark }
      : {
          kind: "COMPETENCY",
          criterion: criterion.criterion,
          rating: mark,
          feedback: FEEDBACK[mark as Level][Math.floor(next() * FEEDBACK[mark as Level].length)],
        };
  });
  const saved = await course.api.call<{ grade: string; version: number }>(grader, "/grades/save", {
    grade: recorded.grade,
    version: recorded.version,
    judgments,
    feedback: "",
  });
  if (plan.mark === "released") await course.api.call(grader, "/grades/release", saved);
}

async function reviseDue(course: Course, key: string, dueAt: Date) {
  const entry = course.assignments.get(key);
  if (!entry) return;
  await course.api.call(course.admin, "/assignments/revise", {
    ...entry.draft,
    assignment: entry.id,
    dueAt: dueAt.toISOString(),
  });
  entry.draft.dueAt = dueAt.toISOString();
}

// ---------------------------------------------------------------- live runs

interface RunPlan {
  title: string;
  kind: "quiz" | "survey" | "relay";
  lecture: boolean;
  prompt: string;
  choices: string[];
  expected: string;
  rounds?: string[];
}

const RUNS: RunPlan[] = [
  {
    title: "Warm-up: what is a concept?",
    kind: "quiz",
    lecture: true,
    prompt: "Which of these is a concept?",
    choices: ["Upvote", "Login button", "Database"],
    expected: "Upvote",
  },
  {
    title: "Purpose check",
    kind: "quiz",
    lecture: true,
    prompt: "What does a concept's purpose say?",
    choices: ["Why it exists", "How it is stored", "Who built it"],
    expected: "Why it exists",
  },
  {
    title: "Pace check",
    kind: "survey",
    lecture: true,
    prompt: "How is the pace so far?",
    choices: ["Too slow", "About right", "Too fast"],
    expected: "",
  },
  {
    title: "Studio: critique relay",
    kind: "relay",
    lecture: true,
    prompt: "",
    choices: [],
    expected: "",
    rounds: ["Name a concept that fails its purpose", "Say how you'd fix it"],
  },
  {
    title: "Syncs check",
    kind: "quiz",
    lecture: true,
    prompt: "Where does a sync live?",
    choices: ["Between concepts", "Inside a concept", "In the database"],
    expected: "Between concepts",
  },
  {
    title: "Data modeling check",
    kind: "quiz",
    lecture: true,
    prompt: "A many-to-many relation needs…",
    choices: ["A join collection", "Two arrays", "A foreign key"],
    expected: "A join collection",
  },
  {
    title: "Visual hierarchy check",
    kind: "quiz",
    lecture: true,
    prompt: "What draws the eye first?",
    choices: ["Contrast", "Alignment", "Whitespace"],
    expected: "Contrast",
  },
  {
    title: "Studio: proposal relay",
    kind: "relay",
    lecture: true,
    prompt: "",
    choices: [],
    expected: "",
    rounds: ["Whose problem does your project solve?", "What evidence do you have?"],
  },
  {
    title: "Team formation survey",
    kind: "survey",
    lecture: true,
    prompt: "Do you have a team yet?",
    choices: ["Yes", "Still looking", "Want to be placed"],
    expected: "",
  },
  {
    title: "Office hours poll",
    kind: "survey",
    lecture: false,
    prompt: "Which office hours slot suits you?",
    choices: ["Mon evening", "Wed lunch", "Fri morning"],
    expected: "",
  },
];

interface RunResult {
  run: string;
  title: string;
  kind: string;
  lecture: boolean;
  joined: number;
  joiners: Set<string>;
  /** When the run opened, as the seed's clock read it. */
  openedAt: string;
}

/**
 * One live run: open it, let the joiners in (answering, for a quiz or survey),
 * close it, and mark it as a lecture when it is one. `later` moves a moved
 * clock on by some minutes between the steps; over HTTP it does nothing.
 */
async function liveRun(
  api: Api,
  host: Session,
  plan: RunPlan,
  joiners: Person[],
  next: () => number,
  now: () => number = Date.now,
  later: (minutes: number) => Promise<void> = async () => {},
): Promise<RunResult> {
  const joined = new Set<string>();
  let run: string;
  let openedAt: number;
  if (plan.kind === "relay") {
    const { relay } = await api.call<{ relay: string }>(host, "/live/relays/plan", {
      title: plan.title,
    });
    const legs: string[] = [];
    for (const title of plan.rounds ?? []) {
      const { leg } = await api.call<{ leg: string }>(host, "/live/relays/add-round", {
        relay,
        title,
        prompt: `${title}?`,
        parts: [],
        cap: 0,
        choices: [],
      });
      legs.push(leg);
    }
    openedAt = now();
    const launched = await api.call<{ run: string; token: string }>(host, "/live/relays/launch", {
      relay,
    });
    run = launched.run;
    // Most join the first round; a few arrive for the second only.
    const late = new Set(joiners.filter(() => next() < 0.15).map((person) => person.user));
    for (const [legIndex, leg] of legs.entries()) {
      await later(1);
      const { round } = await api.call<{ round: string }>(host, "/live/relays/open-round", {
        run,
        leg,
      });
      const wave = joiners.filter((person) =>
        legIndex === 0 ? !late.has(person.user) : late.has(person.user) || next() < 0.6,
      );
      await pool(wave, CONCURRENCY, async (person) => {
        await api.call(person, "/live/p/begin-signed", { token: launched.token });
        joined.add(person.user);
      });
      await later(12);
      await api.call(host, "/live/relays/close-round", { round });
    }
    await api.call(host, "/live/relays/close", { run });
  } else {
    const { questionnaire } = await api.call<{ questionnaire: string }>(
      host,
      "/live/quizzes/create",
      {
        title: plan.title,
        form: plan.kind,
      },
    );
    const { question } = await api.call<{ question: string }>(host, "/live/quizzes/add-question", {
      questionnaire,
      prompt: plan.prompt,
      choices: plan.choices,
      expected: plan.expected,
      explanation: "",
    });
    openedAt = now();
    const launched = await api.call<{ run: string; token: string }>(host, "/live/runs/launch", {
      questionnaire,
    });
    run = launched.run;
    await later(1);
    await pool(joiners, CONCURRENCY, async (person) => {
      const { response } = await api.call<{ response: string }>(person, "/live/p/begin-signed", {
        token: launched.token,
      });
      joined.add(person.user);
      // Most answer and submit; a few join and leave.
      if (next() < 0.9) {
        const value =
          plan.expected && next() < 0.7
            ? plan.expected
            : (plan.choices[Math.floor(next() * plan.choices.length)] as string);
        await api.call(person, "/live/p/answer-signed", { response, question, value });
        await api.call(person, "/live/p/submit-signed", { response });
      }
    });
    await later(8);
    await api.call(host, "/live/runs/close", { run });
  }
  if (plan.lecture) await api.call(host, "/live/lectures/mark", { run });
  return {
    run,
    title: plan.title,
    kind: plan.kind,
    lecture: plan.lecture,
    joined: joined.size,
    joiners: joined,
    openedAt: new Date(openedAt).toISOString(),
  };
}

async function runLive(
  api: Api,
  host: Session,
  students: Person[],
  plans: StudentPlan[],
): Promise<RunResult[]> {
  const next = random("lectures");
  const results: RunResult[] = [];
  for (const [position, plan] of RUNS.entries()) {
    const joiners = students.filter((_, index) => {
      const presence = plans[index]?.presence ?? 0;
      // The plain student misses one run.
      if (index === PLAIN) return position !== 5;
      return next() < presence;
    });
    results.push(await liveRun(api, host, plan, joiners, next));
  }
  return results;
}

// ---------------------------------------------------------------- the policy

/** The course guide's attendance rule. */
const ATTENDANCE_RULE = { key: "a-lectures", below: 70, atMost: "B" };

function guidePolicy(
  assignments: ReadonlyMap<string, { id: string; plan: AssignmentPlan }>,
  attendance = false,
): CoursePolicy {
  const rows = (team: boolean) =>
    [...assignments.values()]
      .filter((entry) => (entry.plan.kind === "FINAL_PROJECT") === team)
      .map((entry) => ({
        key: `r-${entry.plan.key}`,
        type: "assignment" as const,
        assignment: entry.id,
        weight: entry.plan.kind === "PERSONAL_PROJECT" ? 2 : 1,
      }));
  const skillWeights: Record<string, Record<string, number>> = {};
  return {
    ratings: { DEFICIENT: 1, EMERGENT: 2, COMPETENT: 3, EXPERT: 4 },
    missing: 0,
    late: "missing",
    skillWeights,
    groups: [
      { key: "g-personal", name: "Personal", weight: 70, combine: "average", rows: rows(false) },
      { key: "g-team", name: "Team", weight: 30, combine: "average", rows: rows(true) },
    ],
    attendance: attendance ? [ATTENDANCE_RULE] : [],
    gradeSet: "letters",
    lines: {
      letters: [
        { grade: "A", at: 3.4 },
        { grade: "B", at: 2.8 },
        { grade: "C", at: 2.2 },
        { grade: "D", at: 1.6 },
      ],
      plusMinus: [
        { grade: "A", at: 3.6 },
        { grade: "A−", at: 3.4 },
        { grade: "B+", at: 3.2 },
        { grade: "B", at: 3.0 },
        { grade: "B−", at: 2.8 },
        { grade: "C+", at: 2.6 },
        { grade: "C", at: 2.4 },
        { grade: "C−", at: 2.2 },
        { grade: "D", at: 1.8 },
      ],
    },
  };
}

// ---------------------------------------------------------------- the seed

export interface CourseScenarioOptions {
  students?: number;
  /** Save a final policy and one override (default true). */
  release?: boolean;
  /** Called with a short line as each phase ends. */
  progress?: (line: string) => void;
}

const KLASS = {
  code: "6.1040",
  title: "Software Design",
  term: "Fall 2026",
  timezone: "America/New_York",
};
const MANAGER_CAPABILITIES = ["course:manage", "grade", "grade-policies"];
const GRADER_CAPABILITIES = ["grade"];
const LATE_DAYS = { defaultDays: 10, maxDaysPerItem: 5, unitHours: 24 };

/** The class, its sections, staff, students, late-day terms, and skills; then the plan. */
async function startCourse(
  api: Api,
  count: number,
  progress: (line: string) => void,
): Promise<StartedCourse> {
  const tag = Math.random().toString(36).slice(2, 6);
  const admin = await api.login("mara");

  // The class and its sections.
  try {
    await api.call(admin, "/roster/configure-class", KLASS);
  } catch {
    await api.call(admin, "/roster/update-class", KLASS);
  }
  const sections = await pool(SECTIONS, CONCURRENCY, async (section) => {
    const created = await api.call<{ section: { _id: string } | string }>(
      admin,
      "/roster/sections/create",
      section,
    );
    const id = typeof created.section === "string" ? created.section : created.section._id;
    return { section: id, name: section.name };
  });

  // Staff, roles, and students.
  const [managerRole, graderRole] = await Promise.all([
    ensureRole(api, admin, "Course manager", MANAGER_CAPABILITIES),
    ensureRole(api, admin, "Course grader", GRADER_CAPABILITIES),
  ]);
  const [manager, grader] = await Promise.all([
    createPerson(api, admin, "Dana Whitaker", tag, "staff.example.edu"),
    createPerson(api, admin, "Jordan Reyes", tag, "staff.example.edu"),
  ]);
  await api.call(admin, "/roles/assign", {
    user: manager.user,
    context: "commons",
    role: managerRole,
  });
  await api.call(admin, "/roles/assign", {
    user: grader.user,
    context: "commons",
    role: graderRole,
  });
  const names = studentNames(count);
  const students = await pool(names, CONCURRENCY, ({ first, last }) =>
    createPerson(api, admin, `${first} ${last}`, tag, "example.edu"),
  );
  // Spread the class over the sections by their shares, in a shuffled order.
  const roll = random("sections");
  const placement = new Map<number, { section: string; name: string }>();
  const shuffled = students
    .map((_, index) => ({ index, key: roll() }))
    .sort((left, right) => left.key - right.key);
  for (const [rank, { index }] of shuffled.entries()) {
    let draw = (rank + 0.5) / count;
    let position = 0;
    while (position < SECTION_SHARES.length - 1 && draw >= (SECTION_SHARES[position] as number)) {
      draw -= SECTION_SHARES[position] as number;
      position += 1;
    }
    placement.set(index, sections[position] as { section: string; name: string });
  }
  for (let start = 0; start < students.length; start += 100)
    await api.call(admin, "/roster/import", {
      rows: students.slice(start, start + 100).map((student, offset) => ({
        email: student.email,
        kind: "STUDENT",
        section: (placement.get(start + offset) as { section: string }).section,
        displayName: student.name,
      })),
    });
  const enrolled = students[ENROLLED] as Person;
  await api.call(admin, "/roles/assign", {
    user: enrolled.user,
    context: "commons",
    role: graderRole,
  });
  progress(`people: ${students.length} students, 2 staff`);

  // Late days, as the course guide sets them.
  await api.call(admin, "/late-days/configure-policy", LATE_DAYS);

  // Skills, and the plan of who hands in what.
  const standards = await defineStandards(api, admin);
  const course: StartedCourse = {
    api,
    admin,
    tag,
    students,
    plans: planStudents(count),
    manager,
    grader,
    assignments: new Map(),
    submissions: new Map(),
    notes: [],
    sections,
    placement,
    managerRole,
    graderRole,
    enrolled,
    standards,
  };
  fixStories(course.plans);
  // Section 1's papers go to the course manager, the rest to the grader.
  for (const [index, plan] of course.plans.entries()) {
    const section = placement.get(index)?.section;
    for (const work of Object.values(plan.work))
      if (work.grader !== "enrolled")
        work.grader = section === sections[0]?.section ? "manager" : "grader";
  }
  return course;
}

async function createAssignment(
  course: StartedCourse,
  plan: AssignmentPlan,
  availableAt: Date,
  dueAt: Date,
) {
  const draft = {
    title: plan.title,
    instructions: plan.instructions,
    kind: plan.kind,
    availableAt: availableAt.toISOString(),
    dueAt: dueAt.toISOString(),
    acceptsSubmissions: true,
    audience: "EVERYONE",
  };
  const { assignment } = await course.api.call<{ assignment: string }>(
    course.admin,
    "/assignments/create-draft",
    draft,
  );
  const setup = await configureSetup(course.api, course.admin, assignment, plan, course.standards);
  await course.api.call(course.admin, "/assignments/publish", { assignment });
  course.assignments.set(plan.key, { id: assignment, plan, setup, draft });
}

/** Each paper of one assignment to its grader: section 1 to the manager, the rest to the grader. */
async function delegate(course: StartedCourse, key: string) {
  const entry = course.assignments.get(key);
  if (!entry) return;
  await pool(course.plans, CONCURRENCY, async (student, index) => {
    const person = course.students[index];
    const who = student.work[key]?.grader;
    if (!person) return;
    const grader =
      who === "enrolled" ? course.enrolled : who === "grader" ? course.grader : course.manager;
    await course.api.call(course.admin, "/delegation/set", {
      item: entry.id,
      learner: person.user,
      grader: grader.user,
    });
  });
}

/** Grade papers; the enrolled grader's, if refused, fall to the manager. */
async function gradePapers(
  course: StartedCourse,
  papers: { key: string; index: number }[],
  refused: string[],
) {
  await pool(papers, CONCURRENCY, async ({ key, index }) => {
    try {
      await gradeWork(course, key, index, course.enrolled);
    } catch (error) {
      const plan = course.plans[index]?.work[key];
      if (plan?.grader !== "enrolled") throw error;
      refused.push(error instanceof Error ? error.message : String(error));
      plan.grader = "manager";
      await gradeWork(course, key, index, course.enrolled);
    }
  });
}

/** A final policy and one override. Commons doesn't release course grades. */
async function releaseCourse(
  course: StartedCourse,
  attendance: boolean,
  _now: () => number,
): Promise<{ coursePolicy: SeededCourse["coursePolicy"]; release: SeededCourse["release"] }> {
  const { api, manager, students } = course;
  const specification = guidePolicy(course.assignments, attendance);
  const created = await api.call<{ policy: string; version: number }>(
    manager,
    "/course-grades/create",
    {
      name: "Course guide",
      specification,
    },
  );
  await api.call(manager, "/course-grades/mark-final", { policy: created.policy });
  const overridden = students[OVERRIDE.student] as Person;
  await api.call(manager, "/course-grades/override", {
    student: overridden.user,
    value: OVERRIDE.value,
    reason: OVERRIDE.reason,
    policy: created.policy,
  });
  const coursePolicy = {
    policy: created.policy,
    name: "Course guide",
    version: created.version,
    final: true,
    attendance: specification.attendance,
    override: { student: overridden.user, value: OVERRIDE.value, reason: OVERRIDE.reason },
  };
  return { coursePolicy, release: null };
}

/** What the seed returns. */
function describeCourse(
  course: StartedCourse,
  details: {
    origin: string;
    clock: SeededCourse["clock"];
    term: SeededCourse["term"];
    availableAt: Map<string, string>;
    dueAt: Map<string, string>;
    uses: { index: number; key: string; days: number }[];
    extensionDue: string;
    runs: RunResult[];
    coursePolicy: SeededCourse["coursePolicy"];
    release: SeededCourse["release"];
    notes: string[];
  },
): SeededCourse {
  const { students, placement } = course;
  const plain = students[PLAIN] as Person;
  const stories: Record<string, string> = {};
  for (const plan of ASSIGNMENTS) {
    const work = course.plans[PLAIN]?.work[plan.key];
    if (!work) continue;
    const days = details.uses.find((use) => use.index === PLAIN && use.key === plan.key)?.days;
    stories[plan.title] =
      work.hand === "not-yet"
        ? "not due yet"
        : days === undefined
          ? work.hand
          : `${work.hand}, ${days} late day${days === 1 ? "" : "s"}`;
  }
  const account = (person: Person): SeededAccount => ({
    user: person.user,
    name: person.name,
    username: person.username,
    password: PASSWORD,
    email: person.email,
  });
  const assignmentId = (key: string) => course.assignments.get(key)?.id ?? key;
  const dateOf = (at: string) => lectureDate(at, KLASS.timezone);
  const lectureDates = [
    ...new Set(details.runs.filter((run) => run.lecture).map((run) => dateOf(run.openedAt))),
  ].sort();
  const seededStudents: SeededStudent[] = students.map((student, index) => {
    const place = placement.get(index) as { section: string; name: string };
    const plan = course.plans[index] as StudentPlan;
    return {
      ...account(student),
      section: place.section,
      sectionName: place.name,
      work: Object.fromEntries(
        Object.entries(plan.work).map(([key, work]) => [
          assignmentId(key),
          {
            hand: work.hand,
            mark:
              work.hand === "missing" || work.hand === "not-yet" || work.hand === "excused"
                ? null
                : work.hand === "early"
                  ? "ungraded"
                  : work.mark,
          },
        ]),
      ),
      lateDays: details.uses
        .filter((use) => use.index === index)
        .map((use) => ({ assignment: assignmentId(use.key), days: use.days })),
      lecturesJoined: new Set(
        details.runs
          .filter((run) => run.lecture && run.joiners.has(student.user))
          .map((run) => dateOf(run.openedAt)),
      ).size,
    };
  });
  const counts = (key: string) => {
    const tally: Record<string, number> = {};
    for (const plan of course.plans) {
      const work = plan.work[key];
      if (!work) continue;
      const label =
        work.hand === "missing" || work.hand === "not-yet" || work.hand === "excused"
          ? work.hand
          : work.hand === "early"
            ? "early, ungraded"
            : `${work.hand}, ${work.mark}`;
      tally[label] = (tally[label] ?? 0) + 1;
    }
    return tally;
  };
  const extensionStudent = students[EXTENSION.student] as Person;
  const ex2 = course.assignments.get("ex2");
  return {
    tag: course.tag,
    origin: details.origin,
    password: PASSWORD,
    clock: details.clock,
    term: details.term,
    class: KLASS,
    sections: course.sections.map((section) => ({
      ...section,
      students: [...placement.values()].filter((place) => place.section === section.section).length,
    })),
    accounts: {
      admin: { username: "mara", password: PASSWORD, capabilities: ["administer"] },
      manager: {
        ...account(course.manager),
        role: course.managerRole,
        capabilities: MANAGER_CAPABILITIES,
      },
      grader: {
        ...account(course.grader),
        role: course.graderRole,
        capabilities: GRADER_CAPABILITIES,
      },
      enrolledGrader: {
        ...account(course.enrolled),
        role: course.graderRole,
        capabilities: GRADER_CAPABILITIES,
        section: (placement.get(ENROLLED) as { section: string }).section,
        delegated: ex2
          ? [
              {
                assignment: ex2.id,
                learners: DELEGATED_TO_ENROLLED.map((index) => (students[index] as Person).user),
              },
            ]
          : [],
      },
      student: {
        ...account(plain),
        section: (placement.get(PLAIN) as { section: string }).section,
        stories,
      },
    },
    standards: course.standards,
    assignments: ASSIGNMENTS.map((plan) => ({
      assignment: assignmentId(plan.key),
      key: plan.key,
      title: plan.title,
      kind: plan.kind,
      method: plan.method,
      availableAt: details.availableAt.get(plan.key) ?? "",
      dueAt: details.dueAt.get(plan.key) ?? "",
      path: `/staff/assignments/${assignmentId(plan.key)}`,
      counts: counts(plan.key),
    })),
    lateDays: {
      ...LATE_DAYS,
      uses: details.uses.length,
      days: details.uses.reduce((sum, use) => sum + use.days, 0),
      extension: {
        assignment: assignmentId(EXTENSION.assignment),
        student: extensionStudent.user,
        dueAt: details.extensionDue,
      },
    },
    lectures: {
      date: lectureDates.at(-1) ?? "",
      dates: lectureDates,
      runs: details.runs.map(({ joiners: _joiners, ...run }) => ({
        ...run,
        date: dateOf(run.openedAt),
      })),
    },
    coursePolicy: details.coursePolicy,
    release: details.release,
    students: seededStudents,
    notes: [...course.notes, ...details.notes],
    calls: course.api.calls,
  };
}

/** Seed over HTTP, every action stamped by the stack's own clock. */
export async function seedCourseScenario(
  origin: string,
  options: CourseScenarioOptions = {},
): Promise<SeededCourse> {
  const count = Math.max(12, options.students ?? 60);
  const release = options.release ?? true;
  const started = Date.now();
  const progress = (line: string) =>
    options.progress?.(`${((Date.now() - started) / 1000).toFixed(1)}s ${line}`);
  const api = new Api(origin.replace(/\/$/, ""));
  const course = await startCourse(api, count, progress);
  const { admin, students } = course;

  // Assignments.
  const now = Date.now();
  const availableAt = new Map<string, string>();
  for (const plan of ASSIGNMENTS) {
    const opens = new Date(now - plan.opensDaysAgo * DAY);
    // Past assignments are due in the future while their on-time papers come in.
    await createAssignment(course, plan, opens, new Date(now + (plan.dueInDays ?? 7) * DAY));
    availableAt.set(plan.key, opens.toISOString());
  }
  progress(`assignments: ${ASSIGNMENTS.length}, skills: ${course.standards.length}`);

  // On-time papers, then each past assignment's due date moves to that moment.
  const dueAt = new Map<string, string>();
  for (const plan of ASSIGNMENTS) {
    const handing = course.plans.flatMap((student, index) => {
      const hand = student.work[plan.key]?.hand;
      return hand === "on-time" || hand === "early" ? [index] : [];
    });
    await pool(handing, CONCURRENCY, (index) => submit(course, plan.key, index));
    const entry = course.assignments.get(plan.key);
    if (plan.dueInDays === null) {
      await pause(20);
      await reviseDue(course, plan.key, new Date());
      await pause(20);
    }
    dueAt.set(plan.key, String(entry?.draft.dueAt));
  }
  progress("on-time papers handed in; due dates set");

  // Late papers, late days on some, and one extension granted after the fact.
  const late = ASSIGNMENTS.flatMap((plan) =>
    course.plans.flatMap((student, index) => {
      const hand = student.work[plan.key]?.hand;
      return hand === "late-covered" || hand === "late-uncovered" || hand === "extension"
        ? [{ key: plan.key, index, hand }]
        : [];
    }),
  );
  // A late paper comes in a little after its due date.
  await pause(1500);
  const uses: { index: number; key: string; days: number }[] = [];
  await pool(late, CONCURRENCY, async ({ key, index }) => submit(course, key, index, true));
  await pool(late, CONCURRENCY, async ({ key, index, hand }) => {
    const entry = course.assignments.get(key);
    const student = students[index];
    if (!entry || !student) return;
    if (hand === "late-covered") {
      await api.call(student, "/late-days/apply", { assignment: entry.id, days: 1 });
      uses.push({ index, key, days: 1 });
    }
  });
  const extensionDue = new Date();
  const extensionEntry = course.assignments.get(EXTENSION.assignment);
  const extensionStudent = students[EXTENSION.student] as Person;
  if (extensionEntry)
    await api.call(admin, "/assignments/set-due-override", {
      assignment: extensionEntry.id,
      assignee: extensionStudent.user,
      dueAt: extensionDue.toISOString(),
    });
  progress(`late papers: ${late.length}, late days applied: ${uses.length}`);

  // Delegation: section 1 to the manager, the rest to the grader, three to the enrolled grader.
  for (const plan of ASSIGNMENTS) await delegate(course, plan.key);
  progress("delegation set");

  // Grading.
  const papers = ASSIGNMENTS.flatMap((plan) =>
    course.plans.map((_, index) => ({ key: plan.key, index })),
  );
  const refused: string[] = [];
  await gradePapers(course, papers, refused);
  if (refused.length > 0)
    course.notes.push(
      `The enrolled grader was refused grading their delegated papers, so the manager graded them: ${refused[0]}`,
    );
  progress(`graded ${papers.length} paper slots`);

  // Live runs, most marked as lectures.
  const runs = await runLive(api, admin, students, course.plans);
  progress(`live runs: ${runs.length}`);

  // A final policy, one override, and a release of grades so far.
  let released: Awaited<ReturnType<typeof releaseCourse>> = { coursePolicy: null, release: null };
  if (release) {
    released = await releaseCourse(course, false, Date.now);
    progress("policy saved, marked final, and released");
  }

  return describeCourse(course, {
    origin,
    clock: "server",
    term: { from: new Date(started).toISOString(), to: new Date().toISOString() },
    availableAt,
    dueAt,
    uses,
    extensionDue: extensionDue.toISOString(),
    runs,
    ...released,
    notes: [
      "Past due dates all fall inside this seeding run, in term order: the server stamps submissions with its own clock, so on-time papers come in while the assignment is due in the future and its due date is then revised to that moment.",
      "Every live run opened today, so the attendance grid shows one lecture date holding every marked run.",
    ],
  });
}

// ---------------------------------------------------------------- on a moved clock

/** An edge built in this process over the stack's database, with a clock the seed moves. */
export interface ClockedEdge {
  transport: Transport;
  /** The moment the seed's actions are stamped with now; it runs on in real time. */
  now(): number;
  /** Wait for every reaction to what came before, then move the clock to a moment. Never moves back. */
  travel(at: number): Promise<void>;
  /** How often a moment was already past when the seed reached it, and by how much at most. */
  overruns: { count: number; maxMs: number };
  close(): Promise<void>;
}

/**
 * Open the stack's database and assemble Commons over it here, the way the
 * stack does, but with a clock this seed sets. The stack has already run its
 * migrations; this edge adds rows only through the API paths.
 */
export async function openClockedEdge(mongodbUrl: string, origin: string): Promise<ClockedEdge> {
  const { MongoClient } = await import("mongodb");
  const { createEdge } = await import("../../../src/edge.ts");
  const { mongoImplementations } = await import("../../../src/concepts.ts");
  const client = new MongoClient(mongodbUrl);
  await client.connect();
  let offset = 0;
  const now = () => Date.now() + offset;
  const clock = () => new Date(now());
  const edge = createEdge(mongoImplementations(client.db(), clock), origin, clock);
  const overruns = { count: 0, maxMs: 0 };
  let moved = false;
  return {
    transport: (request) => edge.fetch(request),
    now,
    overruns,
    async travel(at) {
      await edge.application.whenIdle();
      const behind = now() - at;
      // The first move goes back to the term's start; after that, only forward.
      if (moved && behind > 0) {
        overruns.count += 1;
        overruns.maxMs = Math.max(overruns.maxMs, behind);
        return;
      }
      moved = true;
      offset = Math.min(at, Date.now()) - Date.now();
    },
    async close() {
      await edge.application.whenIdle();
      await client.close();
    },
  };
}

/** Days and times in the class's time zone, counted back from today there. */
class Calendar {
  private readonly today: [number, number, number];
  constructor(
    readonly timezone: string,
    now: number,
  ) {
    this.today = lectureDate(new Date(now), timezone).split("-").map(Number) as [
      number,
      number,
      number,
    ];
  }

  /** The date some days ago (negative for days to come), as `YYYY-MM-DD`. */
  date(daysAgo: number): string {
    const [year, month, day] = this.today;
    return new Date(Date.UTC(year, month - 1, day - daysAgo)).toISOString().slice(0, 10);
  }

  /** The day of the week some days ago, 0 for Sunday. */
  weekday(daysAgo: number): number {
    return new Date(`${this.date(daysAgo)}T12:00:00Z`).getUTCDay();
  }

  /** The moment at a local time of day some days ago. */
  at(daysAgo: number, hour: number, minute = 0): number {
    const [year, month, day] = this.date(daysAgo).split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const wall = Date.UTC(year, month - 1, day, hour, minute);
    const offset = (at: number) => {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: this.timezone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).formatToParts(new Date(at));
      const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
      return (
        Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) -
        Math.floor(at / 60_000) * 60_000
      );
    };
    const guess = wall - offset(wall);
    return wall - offset(guess);
  }
}

const HOUR = 3_600_000;

/** When the term began, and when each assignment opened and fell due, in days ago (negative: to come). */
const TERM_BEGAN = 76;
const TERM: Record<string, { opens: number; due: number }> = {
  ex1: { opens: 74, due: 68 },
  ex2: { opens: 62, due: 54 },
  ex3: { opens: 47, due: 40 },
  pp: { opens: 38, due: 24 },
  fp1: { opens: 17, due: 5 },
  fp2: { opens: 4, due: -16 },
};
/** Papers are due at 10 pm; lectures are Tuesdays and Thursdays at 2:35 pm. */
const DUE_HOUR = 22;
const LECTURE_DAYS = [2, 4];
const LECTURE_COUNT = 11;

/** Two more lecture runs, so the term's eleven lectures each have one. */
const MORE_RUNS: RunPlan[] = [
  {
    title: "State and actions check",
    kind: "quiz",
    lecture: true,
    prompt: "Which belongs in a concept's state?",
    choices: ["What it remembers", "Its buttons", "Its API keys"],
    expected: "What it remembers",
  },
  {
    title: "Beta readiness check",
    kind: "survey",
    lecture: true,
    prompt: "How ready is your team's beta?",
    choices: ["Not started", "Half done", "Nearly there"],
    expected: "",
  },
];

interface TermPlan {
  /** Which lectures, by position, each student joined. */
  attended: Set<number>[];
  /** Students who rarely came but did strong work, so the attendance rule caps them. */
  strongAbsent: number[];
  /** When each paper is handed in, by `key:index`, and the late days applied with it. */
  hands: Map<string, { at: number; days: number }>;
}

/**
 * Lay the term over the plan: who joined which lectures, when each paper came
 * in, and how many late days covered it, within five per paper and ten in all.
 */
function planTerm(course: StartedCourse, calendar: Calendar): TermPlan {
  const next = random("term");
  const count = course.plans.length;
  const below = Math.ceil(LECTURE_COUNT * 0.7) - 1;
  const stories = new Set([
    PLAIN,
    ENROLLED,
    ...DELEGATED_TO_ENROLLED,
    EXCUSED.student,
    EXTENSION.student,
    OVERRIDE.student,
    ...EARLY_BETA,
  ]);
  const others = course.plans
    .map((_, index) => index)
    .filter((index) => !stories.has(index))
    .map((index) => ({ index, key: next() }))
    .sort((left, right) => left.key - right.key)
    .map(({ index }) => index);
  const strongAbsent = others.splice(0, Math.max(3, Math.round(count * 0.05)));
  const absent = new Set(others.splice(0, Math.max(2, Math.round(count * 0.05))));

  // Strong work, all on time, for the students the attendance rule will cap.
  for (const index of strongAbsent) {
    const plan = course.plans[index] as StudentPlan;
    plan.strength = 1;
    for (const assignment of ASSIGNMENTS) {
      const work = plan.work[assignment.key] as WorkPlan;
      if (work.hand !== "not-yet") Object.assign(work, { hand: "on-time", mark: "released" });
      work.marks =
        assignment.method === "POINTS"
          ? assignment.points.map(
              (criterion) => Math.round((0.9 + next() * 0.1) * criterion.maxPoints * 2) / 2,
            )
          : assignment.skills.map(() => (next() < 0.6 ? "EXPERT" : "COMPETENT"));
    }
  }

  const lectures = Array.from({ length: LECTURE_COUNT }, (_, position) => position);
  const attended = course.plans.map((_, index) => {
    let joins: number;
    if (index === PLAIN) joins = LECTURE_COUNT - 1;
    else if (index === ENROLLED) joins = LECTURE_COUNT;
    else if (strongAbsent.includes(index)) joins = below - Math.floor(next() * 3);
    else if (absent.has(index)) joins = 3 + Math.floor(next() * (below - 2));
    else {
      const roll = next();
      joins =
        roll < 0.1 ? below + 1 : roll < 0.35 ? below + 2 : roll < 0.7 ? below + 3 : LECTURE_COUNT;
    }
    const order = lectures
      .map((position) => ({ position, key: next() }))
      .sort((left, right) => left.key - right.key)
      .map(({ position }) => position);
    // The plain student misses the sixth lecture.
    if (index === PLAIN) return new Set(lectures.filter((position) => position !== 5));
    return new Set(order.slice(0, Math.min(LECTURE_COUNT, joins)));
  });

  const hands = new Map<string, { at: number; days: number }>();
  for (const [index, plan] of course.plans.entries()) {
    let balance = LATE_DAYS.defaultDays;
    for (const assignment of ASSIGNMENTS) {
      const work = plan.work[assignment.key] as WorkPlan;
      const term = TERM[assignment.key] as { opens: number; due: number };
      const opens = calendar.at(term.opens, 9);
      const due = calendar.at(term.due, DUE_HOUR);
      const hours = (low: number, high: number) => (low + next() * (high - low)) * HOUR;
      let at: number | null = null;
      let days = 0;
      if (work.hand === "late-covered") {
        const roll = next();
        let wanted = index === PLAIN ? 2 : roll < 0.5 ? 1 : roll < 0.8 ? 2 : 3;
        wanted = Math.min(wanted, LATE_DAYS.maxDaysPerItem, balance);
        if (wanted === 0) work.hand = "late-uncovered";
        else {
          days = wanted;
          balance -= days;
          at = due + (days - 1) * 24 * HOUR + hours(1, 23);
        }
      }
      if (work.hand === "late-uncovered") at = due + hours(0.5, 50);
      else if (work.hand === "extension") at = due + hours(20, 60);
      else if (work.hand === "on-time") {
        const roll = next();
        const before = roll < 0.55 ? hours(0.05, 12) : roll < 0.9 ? hours(12, 48) : hours(48, 120);
        at = Math.max(opens + hours(1, 24), due - before);
        if (at >= due) at = due - hours(0.05, 1);
      } else if (work.hand === "early")
        at = calendar.at(
          1 + Math.floor(next() * 3),
          10 + Math.floor(next() * 10),
          Math.floor(next() * 60),
        );
      if (at !== null) hands.set(`${assignment.key}:${index}`, { at, days });
    }
  }
  return { attended, strongAbsent, hands };
}

/**
 * Seed a term so far through an edge in this process, over the database the
 * running stack at `origin` reads, moving the clock to each moment as it goes.
 */
export async function seedCourseScenarioOnClock(
  mongodbUrl: string,
  origin: string,
  options: CourseScenarioOptions = {},
): Promise<SeededCourse> {
  const count = Math.max(12, options.students ?? 60);
  const release = options.release ?? true;
  const started = Date.now();
  const progress = (line: string) =>
    options.progress?.(`${((Date.now() - started) / 1000).toFixed(1)}s ${line}`);
  origin = origin.replace(/\/$/, "");
  const edge = await openClockedEdge(mongodbUrl, origin);
  try {
    const api = new Api(origin, edge.transport);
    const calendar = new Calendar(KLASS.timezone, started);
    const from = calendar.at(TERM_BEGAN, 9);
    await edge.travel(from);
    const course = await startCourse(api, count, progress);
    const { admin, students } = course;
    const term = planTerm(course, calendar);
    const moment = (key: string, field: "opens" | "due") => {
      const entry = TERM[key] as { opens: number; due: number };
      return field === "opens" ? calendar.at(entry.opens, 9) : calendar.at(entry.due, DUE_HOUR);
    };

    // Everything after the first day, in the order it happened.
    const steps: { at: number; run: () => Promise<void> }[] = [];
    const availableAt = new Map<string, string>();
    const dueAt = new Map<string, string>();
    for (const plan of ASSIGNMENTS) {
      const opens = moment(plan.key, "opens");
      const due = moment(plan.key, "due");
      availableAt.set(plan.key, new Date(opens).toISOString());
      dueAt.set(plan.key, new Date(due).toISOString());
      steps.push({
        at: opens,
        run: async () => {
          await createAssignment(course, plan, new Date(opens), new Date(due));
          await delegate(course, plan.key);
        },
      });
    }

    // The extension: granted two days before the personal project was due, for three days more.
    const extensionDue = calendar.at(
      (TERM[EXTENSION.assignment] as { due: number }).due - 3,
      DUE_HOUR,
    );
    steps.push({
      at: calendar.at((TERM[EXTENSION.assignment] as { due: number }).due + 2, 16),
      run: async () => {
        const entry = course.assignments.get(EXTENSION.assignment);
        if (entry)
          await api.call(admin, "/assignments/set-due-override", {
            assignment: entry.id,
            assignee: (students[EXTENSION.student] as Person).user,
            dueAt: new Date(extensionDue).toISOString(),
          });
      },
    });

    // Papers, each at its own moment, with late days applied as it comes in.
    const uses: { index: number; key: string; days: number }[] = [];
    for (const [where, hand] of term.hands) {
      const [key, position] = where.split(":") as [string, string];
      const index = Number(position);
      steps.push({
        at: hand.at,
        run: async () => {
          const entry = course.assignments.get(key);
          const student = students[index];
          if (!entry || !student) return;
          if (hand.days > 0) {
            await api.call(student, "/late-days/apply", { assignment: entry.id, days: hand.days });
            uses.push({ index, key, days: hand.days });
          }
          await submit(course, key, index, hand.at > moment(key, "due"));
        },
      });
    }

    // Grading: from the fourth day after each due date, over three days, never today.
    const refused: string[] = [];
    for (const plan of ASSIGNMENTS) {
      const due = (TERM[plan.key] as { due: number }).due;
      if (due < 1) continue;
      const days = [...new Set([due - 4, due - 5, due - 6].map((day) => Math.max(1, day)))];
      const papers = course.plans.map((_, index) => ({ key: plan.key, index }));
      const share = Math.ceil(papers.length / days.length);
      for (const [position, day] of days.entries())
        steps.push({
          at: calendar.at(day, 10),
          run: () =>
            gradePapers(course, papers.slice(position * share, (position + 1) * share), refused),
        });
    }

    // Lectures on the last eleven Tuesdays and Thursdays before today, and one poll that isn't one.
    const lectureDays: number[] = [];
    for (let daysAgo = 1; lectureDays.length < LECTURE_COUNT; daysAgo += 1)
      if (LECTURE_DAYS.includes(calendar.weekday(daysAgo))) lectureDays.unshift(daysAgo);
    const lecturePlans = [...RUNS.filter((plan) => plan.lecture)];
    lecturePlans.splice(2, 0, MORE_RUNS[0] as RunPlan);
    lecturePlans.push(MORE_RUNS[1] as RunPlan);
    const poll = RUNS.find((plan) => !plan.lecture) as RunPlan;
    const runs: RunResult[] = [];
    const next = random("lectures");
    const later = (minutes: number) => edge.travel(edge.now() + minutes * 60_000);
    for (const [position, daysAgo] of lectureDays.entries()) {
      const plan = lecturePlans[position] as RunPlan;
      steps.push({
        at: calendar.at(daysAgo, 14, 35),
        run: async () => {
          const joiners = students.filter((_, index) => term.attended[index]?.has(position));
          runs.push(await liveRun(api, admin, plan, joiners, next, edge.now, later));
        },
      });
    }
    let pollDay = (lectureDays[5] as number) - 1;
    while (calendar.weekday(pollDay) !== 5) pollDay -= 1;
    steps.push({
      at: calendar.at(pollDay, 12),
      run: async () => {
        const joiners = students.filter(() => next() < 0.5);
        runs.push(await liveRun(api, admin, poll, joiners, next, edge.now, later));
      },
    });

    // A final policy with the attendance rule, one override, and a release, yesterday evening.
    let released: Awaited<ReturnType<typeof releaseCourse>> = { coursePolicy: null, release: null };
    if (release)
      steps.push({
        at: calendar.at(1, 17),
        run: async () => {
          released = await releaseCourse(course, true, edge.now);
        },
      });

    steps.sort((left, right) => left.at - right.at);
    let shown = 0;
    for (const [position, step] of steps.entries()) {
      await edge.travel(step.at);
      await step.run();
      const done = Math.floor(((position + 1) / steps.length) * 10);
      if (done > shown) {
        shown = done;
        progress(
          `term ${done * 10}%: ${new Date(edge.now()).toISOString().slice(0, 10)}, ${api.calls} calls`,
        );
      }
    }
    await edge.travel(edge.now());
    const to = edge.now();
    if (refused.length > 0)
      course.notes.push(
        `The enrolled grader was refused grading their delegated papers, so the manager graded them: ${refused[0]}`,
      );
    runs.sort((left, right) => left.openedAt.localeCompare(right.openedAt));
    const notes = [
      `Seeded on a moved clock from ${new Date(from).toISOString()} to ${new Date(to).toISOString()}, through an edge in the seed's process over the stack's database; the stack reads it back from there.`,
      `${term.strongAbsent.length} students did strong work but came to fewer than 70% of lectures, so the attendance rule caps them at B.`,
    ];
    if (edge.overruns.count > 0)
      notes.push(
        `${edge.overruns.count} moments were already past when the seed reached them, by at most ${(edge.overruns.maxMs / 1000).toFixed(1)} s; those actions were stamped that much later.`,
      );
    return describeCourse(course, {
      origin,
      clock: "moved",
      term: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      availableAt,
      dueAt,
      uses,
      extensionDue: new Date(extensionDue).toISOString(),
      runs,
      ...released,
      notes,
    });
  } finally {
    await edge.close();
  }
}

// ---------------------------------------------------------------- checks

export interface CourseChecks {
  courseGrades: {
    students: number;
    policies: number;
    releases: number;
    /** The distinct dates of the lecture runs the page's inputs hold. */
    lectureDates: number;
    /** Grades the attendance rule lowered, computed from the page's inputs under the seeded policy. */
    capped: number;
    /** How many students hold each grade, under the seeded policy now. */
    grades: Record<string, number>;
    bytes: number;
  };
  attendance: {
    students: number;
    runs: number;
    lectures: number;
    dates: string[];
    present: number;
    /** Students present at fewer than 70% of lectures. */
    below70: number;
    bytes: number;
  };
  studentLateDays: { uses: number; days: number[]; unitHours: number; maxDaysPerItem: number };
  enrolledGraderCourseGrades: string;
}

/** Read back what a rehearsal opens first, as each role, over HTTP from the running stack. */
export async function checkCourseScenario(seeded: SeededCourse): Promise<CourseChecks> {
  const api = new Api(seeded.origin.replace(/\/$/, ""));
  const manager = await api.login(seeded.accounts.manager.username);
  const student = await api.login(seeded.accounts.student.username);
  const enrolled = await api.login(seeded.accounts.enrolledGrader.username);
  const read = await api.post<{
    page: { inputs: CourseGradeInputs; policies: unknown[]; releases: unknown[] } | null;
  }>(manager.cookie, "/course-grades/read", {});
  const inputs = read.body.page?.inputs;
  let capped = 0;
  const grades: Record<string, number> = {};
  if (inputs && seeded.coursePolicy) {
    const { specification } = await api.call<{ specification: CoursePolicy }>(
      manager,
      "/course-grades/policy",
      {
        policy: seeded.coursePolicy.policy,
      },
    );
    const now = new Date();
    for (const grade of courseGrades(specification, inputs, now, now)) {
      if (grade.cappedBy !== null) capped += 1;
      const key = grade.grade ?? "none";
      grades[key] = (grades[key] ?? 0) + 1;
    }
  }
  const grid = await api.post<{
    runs: LectureRun[];
    students: { user: string }[];
    timezone: string | null;
  }>(manager.cookie, "/live/lectures/attendance", {});
  const lectures = lectureAttendance({
    runs: grid.body.runs,
    students: grid.body.students.map((entry) => entry.user),
    timezone: grid.body.timezone,
  });
  const total = lectures.lectures.length;
  const below70 = grid.body.students.filter(
    (entry) => total > 0 && ((lectures.attended.get(entry.user)?.size ?? 0) / total) * 100 < 70,
  ).length;
  const lateDays = await api.call<{
    uses: { days: number }[];
    unitHours: number;
    maxDaysPerItem: number;
  }>(student, "/late-days/list");
  let enrolledRead = "allowed";
  try {
    await api.call(enrolled, "/course-grades/read");
  } catch (error) {
    enrolledRead = (error instanceof Error ? error.message : String(error)).replace(/^.*?: /, "");
  }
  return {
    courseGrades: {
      students: inputs?.students.length ?? 0,
      policies: read.body.page?.policies.length ?? 0,
      releases: read.body.page?.releases.length ?? 0,
      lectureDates: new Set(
        (inputs?.lectureRuns ?? []).map((run) =>
          lectureDate(run.openedAt, inputs?.timezone ?? null),
        ),
      ).size,
      capped,
      grades,
      bytes: read.bytes,
    },
    attendance: {
      students: grid.body.students.length,
      runs: grid.body.runs.length,
      lectures: total,
      dates: lectures.lectures.map((lecture) => lecture.date),
      present: lectures.lectures.reduce((sum, lecture) => sum + lecture.present.length, 0),
      below70,
      bytes: grid.bytes,
    },
    studentLateDays: {
      uses: lateDays.uses.length,
      days: lateDays.uses.map((use) => use.days),
      unitHours: lateDays.unitHours,
      maxDaysPerItem: lateDays.maxDaysPerItem,
    },
    enrolledGraderCourseGrades: enrolledRead,
  };
}

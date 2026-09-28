import { invitationCredential } from "../../../src/concepts/inviting/credential.ts";

/**
 * Seeds one graded assignment into a running Commons stack for the Grades tab.
 *
 * Every scenario makes its own section, learners, graders, and published
 * assignment (targeted at that section), all suffixed with a random tag, so
 * any number of scenarios, or the same one twice, coexist in one stack. The
 * expected readiness counts are derived from what each learner was put
 * through, in the same terms as `frontend/src/lib/grade-analysis.ts`.
 */

export const SCENARIOS = [
  "small-mixed",
  "large",
  "points",
  "large-points",
  "method-switch",
  "setup-edited-points",
  "setup-edited-rubric",
  "all-drafts",
  "all-released",
  "blank-feedback",
  "idle-grader",
  "no-delegation",
] as const;
export type ScenarioName = (typeof SCENARIOS)[number];

export function isScenarioName(value: string): value is ScenarioName {
  return (SCENARIOS as readonly string[]).includes(value);
}

/** What the seeder did to one learner; `dropped` and `not-submitted` are never counted. */
export type SeededState =
  | "released"
  | "complete"
  | "incomplete"
  | "not-started"
  | "new-attempt"
  | "excused"
  | "dropped"
  | "not-submitted";

export interface SeededLearner {
  id: string;
  name: string;
  username: string;
  email: string;
  state: SeededState;
  /** The delegated grader's id, or null with no delegation. */
  grader: string | null;
  /** A complete assessment whose overall and criterion feedback are all blank. */
  withoutFeedback: boolean;
  /** The latest submitted attempt, or null with none. */
  submission: string | null;
  /** What the latest attempt says, as submitted (it begins with the learner's name); null with none. */
  content: string | null;
  /** One mark per criterion of the setup the paper was graded under (null: unrated); empty when ungraded. */
  marks: (Rating | number | null)[];
  /** One feedback per criterion, as saved; empty when ungraded. */
  criterionFeedback: string[];
  /** The assessment's overall feedback, as saved; empty when ungraded. */
  feedback: string;
  graded: SeededSetup | null;
}

export interface SeededSetup {
  revision: number;
  criteria: { name: string; maxPoints: number | null; basis: string | null }[];
}

export interface SeededGrader {
  id: string;
  name: string;
  username: string;
  password: string;
  /** How many learners are delegated to this grader. */
  delegated: number;
}

export interface ExpectedReadiness {
  counted: number;
  complete: number;
  released: number;
  incomplete: number;
  notStarted: number;
  newAttempts: number;
  excused: number;
  withoutFeedback: number;
  withoutGrader: number;
  /** Assigned learners who left the course, whom the tab counts nowhere else. */
  dropped: number;
}

export interface SeededScenario {
  scenario: ScenarioName;
  tag: string;
  title: string;
  assignment: string;
  /** The staff page, relative to the web origin. */
  path: string;
  section: string;
  learners: SeededLearner[];
  graders: SeededGrader[];
  expected: ExpectedReadiness;
  /** What else the scenario holds that a test may look for. */
  notes: string[];
}

const PASSWORD = "password123";
const CONCURRENCY = 8;

// ---------------------------------------------------------------- transport

interface Session {
  user: string;
  cookie: string;
}

class Api {
  constructor(readonly origin: string) {}

  async post<T>(cookie: string | null, path: string, data: unknown) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${this.origin}/api${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {}),
          },
          body: JSON.stringify(data),
        });
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
      return { body: body as T, setCookie };
    }
    throw new Error(`${path}: ${lastError instanceof Error ? lastError.message : lastError}`);
  }

  async call<T>(session: Session, path: string, data: unknown): Promise<T> {
    return (await this.post<T>(session.cookie, path, data)).body;
  }

  async login(username: string, password = PASSWORD): Promise<Session> {
    const { body, setCookie } = await this.post<{ user: string }>(null, "/auth/login", {
      username,
      password,
    });
    if (!setCookie) throw new Error(`No session cookie for ${username}`);
    return { user: body.user, cookie: setCookie };
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

/** Deterministic randomness, so a scenario's shape is the same on every seeding. */
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
  "Castillo",
  "Chen",
  "Adeyemi",
  "Berg",
  "Moreau",
  "Santos",
  "Demir",
  "Dubois",
  "Iyer",
  "Lindqvist",
  "Nwosu",
  "Ferreira",
  "Sato",
  "Qureshi",
  "Volkov",
  "Levi",
  "Ortega",
  "Siddiqui",
  "Keller",
  "Farouk",
  "Boateng",
  "Petrova",
  "Kapoor",
  "Goldberg",
  "Hussain",
  "Johansson",
  "Aziz",
  "Morales",
  "Price",
  "Karimi",
];
const GRADER_NAMES = [
  "Jordan Reyes",
  "Sam Whitfield",
  "Alex Moreno",
  "Taylor Brooks",
  "Casey Lin",
  "Robin Achebe",
  "Morgan Healy",
  "Jamie Novak",
  "Riley Osei",
  "Drew Kowalski",
];

function learnerNames(count: number): { first: string; last: string }[] {
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

async function createPerson(
  api: Api,
  admin: Session,
  name: string,
  username: string,
  email: string,
): Promise<Person> {
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
  return { ...session, name, username, email };
}

async function graderRole(api: Api, admin: Session): Promise<string> {
  const name = "Scenario grader";
  const find = async () =>
    (
      await api.call<{ roles: { role: string; name: string }[] }>(admin, "/roles/list", {})
    ).roles.find((role) => role.name === name)?.role;
  const existing = await find();
  if (existing) return existing;
  try {
    return (
      await api.call<{ role: string }>(admin, "/roles/define", { name, capabilities: ["grade"] })
    ).role;
  } catch (error) {
    const again = await find();
    if (again) return again;
    throw error;
  }
}

// ---------------------------------------------------------------- rubric

export type Level = "DEFICIENT" | "EMERGENT" | "COMPETENT" | "EXPERT";
export type Rating = Level | "NOT_ASSESSED";
const LEVELS: Level[] = ["DEFICIENT", "EMERGENT", "COMPETENT", "EXPERT"];

export interface StandardText {
  name: string;
  description: string;
  deficient: string;
  emergent: string;
  competent: string;
  expert: string;
}

export const MODEL: StandardText = {
  name: "Explains the model",
  description: "Explains the concept's state and actions and how they serve its purpose.",
  deficient: "The model is missing or restates the prompt.",
  emergent: "Names the state and actions but not how they serve the purpose.",
  competent: "Explains how the state and actions fulfil the purpose.",
  expert: "Explains the model and why it beats a plausible alternative.",
};
export const EVIDENCE: StandardText = {
  name: "Uses evidence",
  description: "Grounds claims about the design in the interviews and observations.",
  deficient: "No evidence cited.",
  emergent: "Cites evidence but does not use it to argue.",
  competent: "Uses evidence to support each main claim.",
  expert: "Weighs conflicting evidence and says what it would change.",
};
export const EVIDENCE_REVISED: StandardText = {
  ...EVIDENCE,
  description: "Grounds each claim about the design in the interviews, observations, or logs.",
  emergent: "Cites evidence, but a reader cannot tell which claim it supports.",
  competent: "Ties a specific piece of evidence to each main claim.",
};
export const SEPARATION: StandardText = {
  name: "Separates concerns",
  description: "Keeps each concept independent and composes concepts only with syncs.",
  deficient: "Concepts read or write each other's state.",
  emergent: "Mostly separate, with one concept reaching into another.",
  competent: "Concepts are independent and composed only by syncs.",
  expert: "Independent concepts, with a justified choice of where each sync lives.",
};

const FEEDBACK: Record<string, Record<Level, string[]>> = {
  [MODEL.name]: {
    DEFICIENT: [
      "The model section repeats the assignment prompt; I couldn't find the state you chose.",
      "There's no state or action list here, so I can't tell what the concept remembers.",
      "You describe the app's screens, not the concept. Start from what it has to remember.",
    ],
    EMERGENT: [
      "You list the state and actions, but never say how they deliver the purpose.",
      "The actions are right, but the state misses who owns each reservation.",
      "Good start: now connect each action back to the purpose in a sentence.",
      "The operational principle is missing, so the actions read as a bare list.",
    ],
    COMPETENT: [
      "Clear state and actions, and the operational principle shows the purpose working.",
      "The model is complete and each action says why it exists.",
      "Solid: the principle walks through a real use and the state supports it.",
      "Well explained. Consider whether 'expires' belongs in state or is derived.",
    ],
    EXPERT: [
      "Excellent: you compare against a queue-based design and show why yours avoids starvation.",
      "The alternative you rejected is exactly the one I'd have proposed. Great reasoning.",
      "Precise model, and the tradeoff discussion is the best in the section.",
    ],
  },
  [EVIDENCE.name]: {
    DEFICIENT: [
      "No interview or observation is cited, so the claims stand on their own.",
      "The design argument never refers to what users told you.",
      "I didn't find any evidence here; the survey results would have helped a lot.",
    ],
    EMERGENT: [
      "You quote two interviews but don't say which claim each one supports.",
      "The evidence is there, but it sits in an appendix and the argument never uses it.",
      "One quote carries the whole argument; the observations point the other way.",
      "Cites the logs, but doesn't explain what the numbers show about the design.",
    ],
    COMPETENT: [
      "Each main claim is backed by an interview or an observation. Nicely done.",
      "Good use of the diary study to justify the reminder action.",
      "You tie the survey result directly to the decision to split the concept.",
    ],
    EXPERT: [
      "You weigh the two interviews that disagree and say what would settle it. Excellent.",
      "The way you let the observation overturn your first design is exactly the point.",
      "Careful and honest use of evidence, including where it's thin.",
    ],
  },
  [SEPARATION.name]: {
    DEFICIENT: [
      "Upvoting reads the Post concept's author field directly; that couples them.",
      "The concepts share one state table, so they can't be reused apart.",
    ],
    EMERGENT: [
      "Mostly independent, but Notification looks up users inside its own action.",
      "One sync is doing two jobs; split it so each concept stays unaware of the other.",
      "Close: the Session concept shouldn't know about courses.",
    ],
    COMPETENT: [
      "Concepts are independent and the syncs are where the coupling lives. Good.",
      "Clean separation; each concept could be lifted into another app.",
      "Nice use of a sync to connect enrolment and grading.",
    ],
    EXPERT: [
      "Independent concepts, and you justify why the reminder sync fires on save, not on submit.",
      "Great discussion of where each sync belongs and what breaks if it moves.",
    ],
  },
};

const POINTS_FEEDBACK = [
  "Strong work overall; Q2 needed one more sync to handle cancellation.",
  "The state model in Q1(a) is right, but the actions miss the undo case.",
  "Good critique in Q2. Show your working on Q1(b) next time.",
  "Several parts are missing; come to office hours and we'll go through Q1 together.",
  "Clear and correct. The critique is especially thoughtful.",
  "Q1(b) confuses the action with its effect; otherwise solid.",
  "Nice job connecting the critique back to the operational principle.",
];

// ---------------------------------------------------------------- grading setup

interface CompetencySetup {
  method: "COMPETENCY";
  revision: number;
  criteria: { criterion: string; standard: string; basis: string; name: string }[];
}
interface PointsSetup {
  method: "POINTS";
  revision: number;
  criteria: { criterion: string; name: string; maxPoints: number }[];
}
type Setup = CompetencySetup | PointsSetup;

interface ConfiguredCriterion {
  criterion: string;
  kind: "COMPETENCY" | "POINTS";
  basis?: string;
  name?: string;
  maxPoints?: number;
  position: number;
}

async function defineStandard(api: Api, admin: Session, text: StandardText) {
  return api.call<{ standard: string; edition: string }>(admin, "/grades/define-standard", {
    ...text,
    referenceUrl: "",
  });
}

async function competencySetup(
  api: Api,
  admin: Session,
  item: string,
  revision: number,
  standards: { standard: string; edition: string; name: string; criterion?: string }[],
): Promise<CompetencySetup> {
  const configured = await api.call<{ revision: number; criteria: ConfiguredCriterion[] }>(
    admin,
    "/grades/configure-setup",
    {
      item,
      method: "COMPETENCY",
      revision,
      criteria: standards.map((entry, position) => ({
        kind: "COMPETENCY",
        basis: entry.edition,
        position,
        ...(entry.criterion ? { criterion: entry.criterion } : {}),
      })),
    },
  );
  return {
    method: "COMPETENCY",
    revision: configured.revision,
    criteria: standards.map((entry) => {
      const found = configured.criteria.find((criterion) => criterion.basis === entry.edition);
      if (!found) throw new Error(`configure-setup lost the edition for ${entry.name}`);
      return {
        criterion: found.criterion,
        standard: entry.standard,
        basis: entry.edition,
        name: entry.name,
      };
    }),
  };
}

async function pointsSetup(
  api: Api,
  admin: Session,
  item: string,
  revision: number,
  criteria: { name: string; maxPoints: number; criterion?: string }[],
): Promise<PointsSetup> {
  const configured = await api.call<{ revision: number; criteria: ConfiguredCriterion[] }>(
    admin,
    "/grades/configure-setup",
    {
      item,
      method: "POINTS",
      revision,
      criteria: criteria.map((entry, position) => ({
        kind: "POINTS",
        name: entry.name,
        maxPoints: entry.maxPoints,
        position,
        ...(entry.criterion ? { criterion: entry.criterion } : {}),
      })),
    },
  );
  return {
    method: "POINTS",
    revision: configured.revision,
    criteria: configured.criteria
      .slice()
      .sort((left, right) => left.position - right.position)
      .map((entry) => ({
        criterion: entry.criterion,
        name: entry.name ?? "",
        maxPoints: entry.maxPoints ?? 0,
      })),
  };
}

// ---------------------------------------------------------------- the plan

/**
 * One learner's plan. `marks` holds one entry per criterion of the setup the
 * paper is graded under: a rating (competency) or a score (points), or null to
 * leave that criterion unrated.
 */
interface Plan {
  state: SeededState;
  grader: number | null;
  marks?: (Rating | number | null)[];
  criterionFeedback?: string[];
  feedback?: string;
  /** Who records and saves the paper; the delegated grader unless "admin". */
  savedBy?: "grader" | "admin";
  /** Who presses release; the delegated grader unless "admin". */
  releasedBy?: "grader" | "admin";
  /** Record an assessment and save it without judgments (opened, not started). */
  opened?: boolean;
}

interface Stage {
  admin: Session;
  api: Api;
  tag: string;
  learners: Person[];
  graders: Person[];
  assignment: string;
  submissions: Map<string, string>;
  /** Each learner's latest attempt text, by learner id. */
  contents: Map<string, string>;
  setups: Map<string, Setup>;
}

function blankFeedback(plan: Plan): boolean {
  return (
    (plan.feedback ?? "").trim() === "" &&
    (plan.criterionFeedback ?? []).every((text) => text.trim() === "")
  );
}

function pick<T>(items: readonly T[], next: () => number): T {
  return items[Math.floor(next() * items.length)] as T;
}

/** Feedback for each rated criterion, drawn from the bank for its standard and level. */
function writtenFeedback(
  setup: CompetencySetup,
  marks: (Rating | number | null)[],
  next: () => number,
) {
  return setup.criteria.map((criterion, index) => {
    const mark = marks[index];
    if (typeof mark !== "string" || mark === "NOT_ASSESSED") return "";
    const bank = FEEDBACK[criterion.name];
    return bank ? pick(bank[mark], next) : "";
  });
}

function actor(stage: Stage, plan: Plan, who: "grader" | "admin" | undefined): Session {
  if (who === "admin" || plan.grader === null) return stage.admin;
  return stage.graders[plan.grader] as Session;
}

async function gradePaper(
  stage: Stage,
  learner: Person,
  plan: Plan,
  setup: Setup,
  evidence: string,
) {
  const saver = actor(stage, plan, plan.savedBy);
  const recorded = await stage.api.call<{ grade: string; version: number }>(
    saver,
    "/grades/record",
    {
      learner: learner.user,
      item: stage.assignment,
      evidence,
      revision: setup.revision,
    },
  );
  if (plan.state === "excused") {
    await stage.api.call(saver, "/grades/excuse", {
      grade: recorded.grade,
      version: recorded.version,
      feedback: plan.feedback ?? "Excused: documented medical absence.",
    });
    return;
  }
  const marks = plan.opened ? [] : (plan.marks ?? []);
  const criteria: { criterion: string }[] = setup.criteria;
  const judgments = criteria.flatMap((criterion, index): Record<string, unknown>[] => {
    const mark = marks[index];
    if (mark === null || mark === undefined) return [];
    return setup.method === "COMPETENCY"
      ? [
          {
            kind: "COMPETENCY",
            criterion: criterion.criterion,
            rating: mark,
            feedback: plan.criterionFeedback?.[index] ?? "",
          },
        ]
      : [{ kind: "POINTS", criterion: criterion.criterion, score: mark }];
  });
  const saved = await stage.api.call<{ grade: string; version: number }>(saver, "/grades/save", {
    grade: recorded.grade,
    version: recorded.version,
    judgments,
    feedback: plan.opened ? "" : (plan.feedback ?? ""),
  });
  if (plan.state === "released" || plan.state === "new-attempt")
    await stage.api.call(actor(stage, plan, plan.releasedBy), "/grades/release", saved);
}

const SUBMISSION_TEXT = [
  "The Reservation concept holds each slot and who holds it; reserve and cancel keep the purpose of fair access.",
  "My design splits Upvoting from Karma so each can be reused; a sync links them when a post is upvoted.",
  "Interview 2 showed people forget to cancel, so the reminder action fires a day before the slot.",
  "I chose to keep the queue in state rather than deriving it, since cancellations reorder it.",
  "The critique: the original app mixes notifications into the post concept, which couples them.",
];

// ---------------------------------------------------------------- scaffolding

interface Scaffold extends Stage {
  scenario: ScenarioName;
  title: string;
  section: string;
  delegation: (string | null)[];
}

async function scaffold(
  api: Api,
  scenario: ScenarioName,
  learnerCount: number,
  graderCount: number,
): Promise<Scaffold> {
  const tag = Math.random().toString(36).slice(2, 6);
  const admin = await api.login("mara");
  const title = `${scenario} ${tag}: Concept critique`;
  const {
    section: { _id: section },
  } = await api.call<{ section: { _id: string } }>(admin, "/roster/sections/create", {
    name: `Grades ${scenario} ${tag}`,
    location: "",
    meetingPattern: "",
  });
  const role = await graderRole(api, admin);
  const graders = await pool(
    Array.from({ length: graderCount }, (_, index) => index),
    CONCURRENCY,
    async (index) => {
      const name = GRADER_NAMES[index % GRADER_NAMES.length] as string;
      const [first = "grader", last = String(index)] = name.split(" ");
      const person = await createPerson(
        api,
        admin,
        name,
        handle([first, last], tag),
        `${first}.${last}.${tag}@staff.example.edu`.toLowerCase(),
      );
      await api.call(admin, "/roles/assign", { user: person.user, context: "commons", role });
      return person;
    },
  );
  const learners = await pool(learnerNames(learnerCount), CONCURRENCY, async ({ first, last }) =>
    createPerson(
      api,
      admin,
      `${first} ${last}`,
      handle([first, last], tag),
      `${first}.${last}.${tag}@example.edu`.toLowerCase(),
    ),
  );
  for (let start = 0; start < learners.length; start += 100)
    await api.call(admin, "/roster/import", {
      rows: learners.slice(start, start + 100).map((learner) => ({
        email: learner.email,
        kind: "STUDENT",
        section,
        displayName: learner.name,
      })),
    });
  const now = Date.now();
  const { assignment } = await api.call<{ assignment: string }>(
    admin,
    "/assignments/create-draft",
    {
      title,
      instructions:
        "Critique the reservation app's concepts: give the state, actions, and operational principle of one concept, argue from your interviews, and say where the syncs belong.",
      kind: "HOMEWORK",
      availableAt: new Date(now - 14 * 86_400_000).toISOString(),
      dueAt: new Date(now - 3 * 86_400_000).toISOString(),
      acceptsSubmissions: true,
      audience: "TARGETS",
      targets: [section],
    },
  );
  return {
    api,
    admin,
    tag,
    scenario,
    title,
    section,
    learners,
    graders,
    assignment,
    submissions: new Map(),
    contents: new Map(),
    setups: new Map(),
    delegation: learners.map(() => null),
  };
}

async function publish(stage: Scaffold) {
  await stage.api.call(stage.admin, "/assignments/publish", { assignment: stage.assignment });
}

/** Every learner whose plan involves a submission submits once, in parallel. */
async function submitAll(stage: Scaffold, plans: Plan[]) {
  await pool(stage.learners, CONCURRENCY, async (learner, index) => {
    const plan = plans[index] as Plan;
    if (plan.state === "excused" || plan.state === "not-submitted") return;
    const content = `${learner.name}: ${SUBMISSION_TEXT[index % SUBMISSION_TEXT.length]}`;
    const { submission } = await stage.api.call<{ submission: string }>(
      learner,
      "/assignments/submit",
      { assignment: stage.assignment, content },
    );
    stage.submissions.set(learner.user, submission);
    stage.contents.set(learner.user, content);
  });
}

async function delegateAll(stage: Scaffold, plans: Plan[]) {
  await pool(stage.learners, CONCURRENCY, async (learner, index) => {
    const grader = (plans[index] as Plan).grader;
    if (grader === null) return;
    const person = stage.graders[grader] as Person;
    stage.delegation[index] = person.user;
    await stage.api.call(stage.admin, "/delegation/set", {
      item: stage.assignment,
      learner: learner.user,
      grader: person.user,
    });
  });
}

/** Grade the learners at `indices` under `setup`; skips anyone whose plan holds no assessment. */
async function gradeAll(stage: Scaffold, plans: Plan[], setup: Setup, indices?: number[]) {
  const chosen = indices ?? plans.map((_, index) => index);
  await pool(chosen, CONCURRENCY, async (index) => {
    const plan = plans[index] as Plan;
    const learner = stage.learners[index] as Person;
    if (plan.state === "not-submitted") return;
    if (plan.state === "not-started" && !plan.opened) return;
    const evidence = plan.state === "excused" ? "" : (stage.submissions.get(learner.user) ?? "");
    await gradePaper(stage, learner, plan, setup, evidence);
    stage.setups.set(learner.user, setup);
  });
}

/** The new-attempt learners submit a second time after their first attempt was assessed. */
async function resubmit(stage: Scaffold, plans: Plan[]) {
  await pool(stage.learners, CONCURRENCY, async (learner, index) => {
    if ((plans[index] as Plan).state !== "new-attempt") return;
    const content = `${learner.name}: revised after feedback. I now tie each claim to an interview and moved the reminder into its own sync.`;
    const { submission } = await stage.api.call<{ submission: string }>(
      learner,
      "/assignments/submit",
      { assignment: stage.assignment, content },
    );
    stage.submissions.set(learner.user, submission);
    stage.contents.set(learner.user, content);
  });
}

async function dropAll(stage: Scaffold, plans: Plan[]) {
  const dropping = stage.learners.filter((_, index) => (plans[index] as Plan).state === "dropped");
  if (dropping.length === 0) return;
  const { members } = await stage.api.call<{ members: { seat: string; user: string | null }[] }>(
    stage.admin,
    "/roster/list",
    {},
  );
  for (const learner of dropping) {
    const seat = members.find((member) => member.user === learner.user)?.seat;
    if (!seat) throw new Error(`No seat for ${learner.username}`);
    await stage.api.call(stage.admin, "/roster/drop", { seat });
  }
}

function seededSetup(setup: Setup | undefined): SeededSetup | null {
  if (!setup) return null;
  const criteria: (CompetencySetup["criteria"][number] | PointsSetup["criteria"][number])[] =
    setup.criteria;
  return {
    revision: setup.revision,
    criteria: criteria.map((criterion) => ({
      name: criterion.name,
      maxPoints: "maxPoints" in criterion ? criterion.maxPoints : null,
      basis: "basis" in criterion ? criterion.basis : null,
    })),
  };
}

function finish(stage: Scaffold, plans: Plan[], notes: string[]): SeededScenario {
  const learners: SeededLearner[] = stage.learners.map((learner, index) => {
    const plan = plans[index] as Plan;
    const complete = plan.state === "released" || plan.state === "complete";
    return {
      id: learner.user,
      name: learner.name,
      username: learner.username,
      email: learner.email,
      state: plan.state,
      grader: stage.delegation[index] ?? null,
      withoutFeedback: complete && blankFeedback(plan),
      submission: stage.submissions.get(learner.user) ?? null,
      content: stage.contents.get(learner.user) ?? null,
      marks: plan.opened || plan.state === "excused" ? [] : (plan.marks ?? []),
      criterionFeedback: plan.criterionFeedback ?? [],
      feedback:
        plan.opened || plan.state === "not-submitted" || plan.state === "not-started"
          ? ""
          : (plan.feedback ?? ""),
      graded:
        plan.opened || plan.state === "excused"
          ? null
          : seededSetup(stage.setups.get(learner.user)),
    };
  });
  return {
    scenario: stage.scenario,
    tag: stage.tag,
    title: stage.title,
    assignment: stage.assignment,
    path: `/staff/assignments/${stage.assignment}`,
    section: stage.section,
    learners,
    graders: stage.graders.map((grader) => ({
      id: grader.user,
      name: grader.name,
      username: grader.username,
      password: PASSWORD,
      delegated: stage.delegation.filter((owner) => owner === grader.user).length,
    })),
    expected: expectedOf(learners),
    notes,
  };
}

/**
 * The readiness counts for any set of seeded learners (a whole class, or one
 * grader's pile). An excused learner needs no grader, so is never "without a
 * grader"; a dropped learner is counted only as dropped.
 */
export function expectedOf(learners: readonly SeededLearner[]): ExpectedReadiness {
  const counted = learners.filter(
    (learner) => learner.state !== "dropped" && learner.state !== "not-submitted",
  );
  const count = (keep: (learner: SeededLearner) => boolean) => counted.filter(keep).length;
  return {
    counted: counted.length,
    complete: count((learner) => learner.state === "released" || learner.state === "complete"),
    released: count((learner) => learner.state === "released"),
    incomplete: count((learner) => learner.state === "incomplete"),
    notStarted: count((learner) => learner.state === "not-started"),
    newAttempts: count((learner) => learner.state === "new-attempt"),
    excused: count((learner) => learner.state === "excused"),
    withoutFeedback: count((learner) => learner.withoutFeedback),
    withoutGrader: count((learner) => learner.grader === null && learner.state !== "excused"),
    dropped: learners.filter((learner) => learner.state === "dropped").length,
  };
}

/** The common shape: define standards, configure competency, publish, submit, delegate, grade. */
async function competencyScenario(
  api: Api,
  scenario: ScenarioName,
  graderCount: number,
  plans: Plan[],
  standards: StandardText[],
  notes: string[],
) {
  const stage = await scaffold(api, scenario, plans.length, graderCount);
  const defined = await Promise.all(
    standards.map(async (text) => ({
      ...(await defineStandard(api, stage.admin, text)),
      name: text.name,
    })),
  );
  const setup = await competencySetup(api, stage.admin, stage.assignment, 0, defined);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  const next = random(scenario);
  for (const plan of plans)
    if (plan.marks && !plan.criterionFeedback && plan.feedback === undefined) {
      plan.criterionFeedback = writtenFeedback(setup, plan.marks, next);
      plan.feedback = "";
    }
  await gradeAll(stage, plans, setup);
  await resubmit(stage, plans);
  await dropAll(stage, plans);
  return finish(stage, plans, notes);
}

// ---------------------------------------------------------------- scenarios

const NEAR_A = "Cites the interview data but doesn't use it to argue why the design works.";
const NEAR_B = "Cites the interview data but does not use it to argue why the design works.";

async function smallMixed(api: Api) {
  const plans: Plan[] = [
    // 0: released by mara, so the assessment's `grader` is not the delegate.
    {
      state: "released",
      grader: 0,
      marks: ["COMPETENT", "COMPETENT"],
      releasedBy: "admin",
      criterionFeedback: [
        "Clear state and actions, and the principle shows the purpose working.",
        NEAR_A,
      ],
      feedback: "Good work overall.",
    },
    // 1: recorded and saved by mara on grader B's pile, released by grader B.
    {
      state: "released",
      grader: 1,
      marks: ["EXPERT", "COMPETENT"],
      savedBy: "admin",
      criterionFeedback: [
        "Excellent: you compare against a queue-based design and show why yours avoids starvation.",
        "Each main claim is backed by an interview or an observation. Nicely done.",
      ],
      feedback: "",
    },
    // 2: complete draft whose evidence feedback nearly matches learner 0's, one column lower.
    {
      state: "complete",
      grader: 1,
      marks: ["COMPETENT", "EMERGENT"],
      criterionFeedback: ["The model is complete and each action says why it exists.", NEAR_B],
      feedback: "",
    },
    // 3: no delegation; mara grades it.
    {
      state: "complete",
      grader: null,
      marks: ["EMERGENT", "EMERGENT"],
      criterionFeedback: [
        "You list the state and actions, but never say how they deliver the purpose.",
        "You quote two interviews but don't say which claim each one supports.",
      ],
      feedback: "Revisit the operational principle before the next assignment.",
    },
    // 4, 5: incomplete drafts, one criterion rated.
    {
      state: "incomplete",
      grader: 0,
      marks: ["DEFICIENT", null],
      criterionFeedback: [
        "The model section repeats the assignment prompt; I couldn't find the state you chose.",
        "",
      ],
      feedback: "",
    },
    {
      state: "incomplete",
      grader: 1,
      marks: [null, "COMPETENT"],
      criterionFeedback: ["", "Good use of the diary study to justify the reminder action."],
      feedback: "",
    },
    // 6, 7: complete, every feedback blank (one draft, one released).
    {
      state: "complete",
      grader: 0,
      marks: ["COMPETENT", "EMERGENT"],
      criterionFeedback: ["", ""],
      feedback: "",
    },
    {
      state: "released",
      grader: 1,
      marks: ["EMERGENT", "DEFICIENT"],
      criterionFeedback: ["  ", ""],
      feedback: " ",
    },
    // 8: assignment excusal with no attempt.
    { state: "excused", grader: 0, feedback: "Excused: documented medical absence." },
    // 9: attempt 1 assessed and released, attempt 2 submitted and unassessed.
    {
      state: "new-attempt",
      grader: 1,
      marks: ["EMERGENT", "EMERGENT"],
      criterionFeedback: [
        "The operational principle is missing, so the actions read as a bare list.",
        "The evidence is there, but it sits in an appendix and the argument never uses it.",
      ],
      feedback: "Please revise and resubmit.",
    },
    // 10: submitted, not started.
    { state: "not-started", grader: 0 },
    // 11: submitted and graded, then dropped from the course.
    {
      state: "dropped",
      grader: 0,
      marks: ["COMPETENT", "EXPERT"],
      criterionFeedback: [
        "Solid: the principle walks through a real use.",
        "Careful and honest use of evidence.",
      ],
      feedback: "",
    },
  ];
  return competencyScenario(
    api,
    "small-mixed",
    2,
    plans,
    [MODEL, EVIDENCE],
    [
      "Learner 0 was released by mara; learner 1 was saved by mara on grader B's pile.",
      "Learners 0 and 2 carry near-identical evidence feedback at Competent and Emergent.",
      "One dropped learner submitted and was graded; the dropped learner is not counted.",
    ],
  );
}

function weighted(weights: [Level, number][], next: () => number): Level {
  let roll = next();
  for (const [level, weight] of weights) {
    if (roll < weight) return level;
    roll -= weight;
  }
  return (weights.at(-1) as [Level, number])[0];
}

function shift(level: Level, by: number): Level {
  const index = Math.max(0, Math.min(3, LEVELS.indexOf(level) + by));
  return LEVELS[index] as Level;
}

async function large(api: Api) {
  const next = random("large");
  const excused = new Set([17, 113]);
  const notStarted = new Set([45, 150, 199]);
  const incomplete = new Set([12, 88, 140, 171, 190]);
  const newAttempt = new Set([60, 130]);
  const dropped = new Set([33, 177]);
  const noGrader = new Set([5, 55, 105, 155]);
  const plans: Plan[] = Array.from({ length: 200 }, (_, index) => {
    const grader = noGrader.has(index) ? null : index % 8;
    if (excused.has(index)) return { state: "excused", grader };
    if (notStarted.has(index)) return { state: "not-started", grader, opened: index === 150 };
    // Grader C reads harder and grader F softer, so split-by-grader shows a difference.
    const bias = grader === 2 && next() < 0.5 ? -1 : grader === 5 && next() < 0.5 ? 1 : 0;
    const marks: (Rating | null)[] = [
      shift(
        weighted(
          [
            ["DEFICIENT", 0.05],
            ["EMERGENT", 0.2],
            ["COMPETENT", 0.55],
            ["EXPERT", 0.2],
          ],
          next,
        ),
        bias,
      ),
      shift(
        weighted(
          [
            ["DEFICIENT", 0.08],
            ["EMERGENT", 0.5],
            ["COMPETENT", 0.34],
            ["EXPERT", 0.08],
          ],
          next,
        ),
        bias,
      ),
      shift(
        weighted(
          [
            ["DEFICIENT", 0.08],
            ["EMERGENT", 0.25],
            ["COMPETENT", 0.5],
            ["EXPERT", 0.17],
          ],
          next,
        ),
        bias,
      ),
    ];
    if (index === 77) marks[2] = "NOT_ASSESSED";
    if (incomplete.has(index)) marks[index % 3] = null;
    const state: SeededState = incomplete.has(index)
      ? "incomplete"
      : newAttempt.has(index)
        ? "new-attempt"
        : dropped.has(index)
          ? "dropped"
          : index % 10 === 3
            ? "complete"
            : "released";
    const plan: Plan = { state, grader, marks };
    if (index % 25 === 7) {
      plan.criterionFeedback = ["", "", ""];
      plan.feedback = "";
    }
    return plan;
  });
  const emergent = plans.filter(
    (plan) =>
      (plan.state === "released" || plan.state === "complete" || plan.state === "incomplete") &&
      plan.marks?.[1] === "EMERGENT",
  ).length;
  if (emergent < 60) throw new Error(`large: only ${emergent} Emergent papers on Uses evidence`);
  return competencyScenario(
    api,
    "large",
    8,
    plans,
    [MODEL, EVIDENCE, SEPARATION],
    [
      `Uses evidence holds ${emergent} papers at Emergent.`,
      "Competency with three criteria: a points criterion cannot share a setup with competency ones.",
      "One paper is Not assessed on Separates concerns; one not-started learner has an opened, empty draft.",
      "Grader C (index 2) rates harder and grader F (index 5) softer.",
    ],
  );
}

export const POINT_CRITERIA = [
  { name: "Q1(a) State model", maxPoints: 10 },
  { name: "Q1(b) Actions", maxPoints: 10 },
  { name: "Q2 Critique", maxPoints: 10 },
];

function pointPlans(count: number, graders: number, seed: string, states: SeededState[]): Plan[] {
  const next = random(seed);
  return Array.from({ length: count }, (_, index) => {
    const state = states[index] ?? "released";
    const marks = [0, 1, 2].map(() => Math.min(10, Math.max(0, Math.round(4 + next() * 7))));
    return {
      state,
      grader: index % graders,
      marks,
      feedback: pick(POINTS_FEEDBACK, next),
    };
  });
}

async function points(api: Api) {
  const plans = pointPlans(12, 2, "points", [
    "released",
    "released",
    "released",
    "released",
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "incomplete",
    "not-started",
    "excused",
  ]);
  // A scored zero on one criterion, and a paper that totals zero.
  (plans[1] as Plan).marks = [7, 0, 6];
  (plans[8] as Plan).marks = [0, 0, 0];
  (plans[8] as Plan).feedback =
    "Nothing here addresses the questions; please come to office hours.";
  (plans[9] as Plan).marks = [8, 6, null];
  (plans[11] as Plan).feedback = "Excused: family emergency.";
  const stage = await scaffold(api, "points", plans.length, 2);
  const setup = await pointsSetup(api, stage.admin, stage.assignment, 0, POINT_CRITERIA);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  await gradeAll(stage, plans, setup);
  return finish(stage, plans, [
    "Points, three criteria out of 10. Learner 1 scores 0 on Q1(b); learner 8 totals 0.",
    "Learner 9 is unscored on Q2, so it has no total.",
  ]);
}

/** The large class's questions: the shared three, then three nearly everyone aces. */
export const LARGE_POINT_CRITERIA = [
  ...POINT_CRITERIA,
  { name: "Q3(a) Tests pass", maxPoints: 10 },
  { name: "Q3(b) Deploys", maxPoints: 10 },
  { name: "Q4 Submits the repository", maxPoints: 5 },
];

async function largePoints(api: Api) {
  const plans = pointPlans(50, 3, "large-points", []);
  // Scores bunch at full marks, as a real class's do; the third grader reads
  // 1.5 lower and scores in half points. Nearly everyone aces the last three.
  const next = random("large-points-marks");
  for (const plan of plans)
    plan.marks = LARGE_POINT_CRITERIA.map(({ maxPoints }, index) => {
      if (index >= POINT_CRITERIA.length) {
        const slip = next() < 0.08;
        if (!slip) return maxPoints;
        return plan.grader === 2 ? maxPoints - 0.5 : maxPoints - 1 - Math.floor(next() * 2);
      }
      const lost = next() ** 4 * 5;
      return plan.grader === 2
        ? Math.max(0, 8.5 - Math.round(lost * 2) / 2)
        : 10 - Math.round(lost);
    });
  const stage = await scaffold(api, "large-points", plans.length, 3);
  const setup = await pointsSetup(api, stage.admin, stage.assignment, 0, LARGE_POINT_CRITERIA);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  await gradeAll(stage, plans, setup);
  return finish(stage, plans, [
    "Points, 50 learners over three graders, every paper released. Q1(a) to Q2 are out of 10 and bunch at full marks; the third grader scores 1.5 lower, in half points.",
    "Q3(a), Q3(b), and Q4 have nearly everyone at full marks.",
  ]);
}

async function methodSwitch(api: Api) {
  const next = random("method-switch");
  const states: SeededState[] = [
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "released",
    "released",
    "complete",
    "complete",
    "incomplete",
    "not-started",
    "not-started",
  ];
  const plans: Plan[] = states.map((state, index) => ({ state, grader: index % 2 }));
  const stage = await scaffold(api, "method-switch", plans.length, 2);
  const defined = await Promise.all(
    [MODEL, EVIDENCE].map(async (text) => ({
      ...(await defineStandard(api, stage.admin, text)),
      name: text.name,
    })),
  );
  const first = await competencySetup(api, stage.admin, stage.assignment, 0, defined);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  const early = [0, 1, 2, 3, 4];
  for (const index of early) {
    const plan = plans[index] as Plan;
    plan.marks = [
      weighted(
        [
          ["EMERGENT", 0.4],
          ["COMPETENT", 0.4],
          ["EXPERT", 0.2],
        ],
        next,
      ),
      weighted(
        [
          ["DEFICIENT", 0.2],
          ["EMERGENT", 0.4],
          ["COMPETENT", 0.4],
        ],
        next,
      ),
    ];
    plan.criterionFeedback = writtenFeedback(first, plan.marks, next);
    plan.feedback = "";
  }
  await gradeAll(stage, plans, first, early);
  const second = await pointsSetup(api, stage.admin, stage.assignment, first.revision, [
    { name: "Design", maxPoints: 10 },
    { name: "Evidence", maxPoints: 10 },
  ]);
  const late = [5, 6, 7, 8, 9];
  for (const index of late) {
    const plan = plans[index] as Plan;
    plan.marks = [Math.round(5 + next() * 5), Math.round(3 + next() * 7)];
    plan.feedback = pick(POINTS_FEEDBACK, next);
  }
  (plans[9] as Plan).marks = [7, null];
  await gradeAll(stage, plans, second, late);
  return finish(stage, plans, [
    "Learners 0-4 were assessed under competency (Explains the model, Uses evidence).",
    "The setup then switched to points (Design, Evidence out of 10); learners 5-9 were assessed under points.",
  ]);
}

async function setupEditedPoints(api: Api) {
  const next = random("setup-edited-points");
  const states: SeededState[] = [
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "incomplete",
    "not-started",
  ];
  const plans: Plan[] = states.map((state, index) => ({ state, grader: index % 2 }));
  const stage = await scaffold(api, "setup-edited-points", plans.length, 2);
  const first = await pointsSetup(api, stage.admin, stage.assignment, 0, POINT_CRITERIA);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  const early = [0, 1, 2, 3, 4, 5];
  for (const index of early) {
    const plan = plans[index] as Plan;
    plan.marks = [0, 1, 2].map(() => Math.round(4 + next() * 6));
    plan.feedback = pick(POINTS_FEEDBACK, next);
  }
  await gradeAll(stage, plans, first, early);
  const [q1a, q1b, q2] = first.criteria as PointsSetup["criteria"];
  const second = await pointsSetup(api, stage.admin, stage.assignment, first.revision, [
    { name: q1a?.name ?? "", maxPoints: 10, criterion: q1a?.criterion },
    { name: q1b?.name ?? "", maxPoints: 12, criterion: q1b?.criterion },
    { name: q2?.name ?? "", maxPoints: 10, criterion: q2?.criterion },
  ]);
  const late = [6, 7, 8, 9, 10];
  for (const index of late) {
    const plan = plans[index] as Plan;
    plan.marks = [
      Math.round(4 + next() * 6),
      Math.round(5 + next() * 7),
      Math.round(4 + next() * 6),
    ];
    plan.feedback = pick(POINTS_FEEDBACK, next);
  }
  (plans[10] as Plan).marks = [6, null, 5];
  await gradeAll(stage, plans, second, late);
  return finish(stage, plans, [
    "Learners 0-5 graded with Q1(b) out of 10; the maximum then became 12 (same criterion id) and learners 6-10 were graded.",
  ]);
}

async function setupEditedRubric(api: Api) {
  const next = random("setup-edited-rubric");
  const states: SeededState[] = [
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "released",
    "released",
    "released",
    "complete",
    "complete",
    "incomplete",
    "not-started",
  ];
  const plans: Plan[] = states.map((state, index) => ({ state, grader: index % 2 }));
  const stage = await scaffold(api, "setup-edited-rubric", plans.length, 2);
  const model = { ...(await defineStandard(api, stage.admin, MODEL)), name: MODEL.name };
  const evidence = { ...(await defineStandard(api, stage.admin, EVIDENCE)), name: EVIDENCE.name };
  const first = await competencySetup(api, stage.admin, stage.assignment, 0, [model, evidence]);
  await publish(stage);
  await submitAll(stage, plans);
  await delegateAll(stage, plans);
  const rate = (indices: number[], setup: CompetencySetup) => {
    for (const index of indices) {
      const plan = plans[index] as Plan;
      plan.marks = [
        weighted(
          [
            ["EMERGENT", 0.3],
            ["COMPETENT", 0.5],
            ["EXPERT", 0.2],
          ],
          next,
        ),
        weighted(
          [
            ["DEFICIENT", 0.15],
            ["EMERGENT", 0.4],
            ["COMPETENT", 0.35],
            ["EXPERT", 0.1],
          ],
          next,
        ),
      ];
      plan.criterionFeedback = writtenFeedback(setup, plan.marks, next);
      plan.feedback = "";
    }
  };
  const early = [0, 1, 2, 3, 4, 5];
  rate(early, first);
  await gradeAll(stage, plans, first, early);
  const revised = await api.call<{ standard: string; edition: string }>(
    stage.admin,
    "/grades/revise-standard",
    {
      standard: evidence.standard,
      expectedEdition: evidence.edition,
      ...EVIDENCE_REVISED,
      referenceUrl: "",
    },
  );
  const [modelCriterion] = first.criteria;
  const second = await competencySetup(api, stage.admin, stage.assignment, first.revision, [
    { ...model, criterion: modelCriterion?.criterion },
    { standard: revised.standard, edition: revised.edition, name: EVIDENCE.name },
  ]);
  const late = [6, 7, 8, 9, 10];
  rate(late, second);
  (plans[10] as Plan).marks = ["COMPETENT", null];
  await gradeAll(stage, plans, second, late);
  return finish(stage, plans, [
    "Learners 0-5 were rated on Uses evidence edition 1; the standard was revised and the criterion replaced by edition 2 for learners 6-10.",
  ]);
}

function uniformPlans(count: number, graders: number, seed: string, state: SeededState): Plan[] {
  const next = random(seed);
  return Array.from({ length: count }, (_, index) => ({
    state,
    grader: index % graders,
    marks: [
      weighted(
        [
          ["DEFICIENT", 0.1],
          ["EMERGENT", 0.3],
          ["COMPETENT", 0.45],
          ["EXPERT", 0.15],
        ],
        next,
      ),
      weighted(
        [
          ["DEFICIENT", 0.1],
          ["EMERGENT", 0.4],
          ["COMPETENT", 0.4],
          ["EXPERT", 0.1],
        ],
        next,
      ),
    ],
  }));
}

async function allDrafts(api: Api) {
  return competencyScenario(
    api,
    "all-drafts",
    2,
    uniformPlans(10, 2, "all-drafts", "complete"),
    [MODEL, EVIDENCE],
    ["Every learner holds a complete draft; nothing is released."],
  );
}

async function allReleased(api: Api) {
  return competencyScenario(
    api,
    "all-released",
    2,
    uniformPlans(10, 2, "all-released", "released"),
    [MODEL, EVIDENCE],
    ["Every learner's assessment is released."],
  );
}

async function blankFeedbackScenario(api: Api) {
  const plans = uniformPlans(10, 2, "blank-feedback", "released");
  plans.forEach((plan, index) => {
    if (index >= 8) return;
    plan.state = index % 2 === 0 ? "complete" : "released";
    plan.criterionFeedback = ["", ""];
    plan.feedback = "";
  });
  return competencyScenario(
    api,
    "blank-feedback",
    2,
    plans,
    [MODEL, EVIDENCE],
    ["Eight of ten complete assessments carry no feedback at all."],
  );
}

async function idleGrader(api: Api) {
  const base = uniformPlans(10, 2, "idle-grader", "released");
  const plans: Plan[] = base.map((plan, index) => {
    if (index >= 8) return { state: "not-submitted", grader: 2 };
    return { ...plan, state: index % 4 === 3 ? "complete" : "released", grader: index % 2 };
  });
  return competencyScenario(
    api,
    "idle-grader",
    4,
    plans,
    [MODEL, EVIDENCE],
    [
      "The third grader holds two learners who never submitted; the fourth holds the role and no learners.",
    ],
  );
}

async function noDelegation(api: Api) {
  const plans = uniformPlans(10, 2, "no-delegation", "released").map((plan, index) => ({
    ...plan,
    grader: null,
    state: (index % 3 === 2 ? "complete" : "released") as SeededState,
  }));
  return competencyScenario(
    api,
    "no-delegation",
    2,
    plans,
    [MODEL, EVIDENCE],
    ["No delegations at all; mara graded every paper. Two graders hold the role."],
  );
}

const BUILDERS: Record<ScenarioName, (api: Api) => Promise<SeededScenario>> = {
  "small-mixed": smallMixed,
  large,
  points,
  "large-points": largePoints,
  "method-switch": methodSwitch,
  "setup-edited-points": setupEditedPoints,
  "setup-edited-rubric": setupEditedRubric,
  "all-drafts": allDrafts,
  "all-released": allReleased,
  "blank-feedback": blankFeedbackScenario,
  "idle-grader": idleGrader,
  "no-delegation": noDelegation,
};

/** Seed one scenario into the stack whose web origin (or edge origin) is `origin`. */
export async function seedGradeScenario(
  origin: string,
  name: ScenarioName,
): Promise<SeededScenario> {
  return BUILDERS[name](new Api(origin.replace(/\/$/, "")));
}

/**
 * Take seeded scenarios back out of the shared course, so a later spec finds
 * the learners and graders it put there itself.
 */
export async function retireGradeScenarios(
  origin: string,
  scenarios: readonly SeededScenario[],
): Promise<void> {
  const api = new Api(origin.replace(/\/$/, ""));
  const admin = await api.login("mara");
  const learners = new Set(scenarios.flatMap((scenario) => scenario.learners.map(({ id }) => id)));
  const { members } = await api.call<{ members: { seat: string; user: string | null }[] }>(
    admin,
    "/roster/list",
    {},
  );
  const seated = members.filter((member) => member.user !== null && learners.has(member.user));
  await pool(seated, CONCURRENCY, ({ seat }) => api.call(admin, "/roster/drop", { seat }));
  const graders = new Set(scenarios.flatMap((scenario) => scenario.graders.map(({ id }) => id)));
  await pool([...graders], CONCURRENCY, (user) =>
    api.call(admin, "/roles/revoke", { context: "commons", user }),
  );
}

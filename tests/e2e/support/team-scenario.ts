import { invitationCredential } from "../../../src/concepts/inviting/credential.ts";
import { lectureDate } from "../../../src/computations/lectures.ts";
import { openClockedEdge } from "./course-scenario.ts";

/**
 * Seeds one class for rehearsing team submissions into a running Commons
 * stack, on a moved clock: an edge in this process over the stack's database,
 * with a clock set to each moment from about three weeks back to yesterday.
 *
 * Fourteen sections serve as teams, one of them a team of one, and one student
 * is on none. A course manager and three graders who are not enrolled grade
 * the work. Eight assignments show each state a team assignment passes
 * through: one each student submitted and was graded on, one switched to each
 * section and not yet moved, one switched and moved with its copied drafts
 * unreleased, one each team submitted and was graded on before a student
 * changed teams, one in progress with a draft, a release, and a team's due
 * override, one not yet started, and two each student submits. Every action
 * goes through the API paths a browser calls.
 *
 * It is meant for a fresh stack: Commons has one class.
 */

const PASSWORD = "password123";
const CONCURRENCY = 10;

// ---------------------------------------------------------------- transport

interface Session {
  user: string;
  cookie: string;
  /** Who to sign in again as when the session has lapsed. */
  username?: string;
}

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
      return { body: body as T, setCookie };
    }
    throw new Error(`${path}: ${lastError instanceof Error ? lastError.message : lastError}`);
  }

  async call<T>(session: Session, path: string, data: unknown = {}): Promise<T> {
    try {
      return (await this.post<T>(session.cookie, path, data)).body;
    } catch (error) {
      // A session lapses after three idle days, which the moved clock passes.
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

  /** The moment at a local time of day some days ago (negative for days to come). */
  at(daysAgo: number, hour: number, minute = 0): number {
    const [year, month, day] = this.today;
    const wall = Date.UTC(year, month - 1, day - daysAgo, hour, minute);
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

// ---------------------------------------------------------------- the class

const KLASS = {
  code: "6.1040",
  title: "Software Design",
  term: "Fall 2026",
  timezone: "America/New_York",
};

interface Project {
  /** What the team is building, as a noun phrase. */
  idea: string;
  users: string;
  pain: string;
  concepts: [string, string, string];
  meets: string;
}

interface TeamPlan extends Project {
  name: string;
  members: string[];
}

const TEAMS: TeamPlan[] = [
  {
    name: "Tidepool",
    members: ["Sam Okafor", "Maya Lindqvist", "Ada Ferreira"],
    idea: "a shared field log for volunteers who count species in tide pools",
    users: "volunteers with the coastal survey",
    pain: "they copy counts from paper sheets into a spreadsheet at night, and half the sheets get wet",
    concepts: ["Sighting", "Survey", "Tide"],
    meets: "Mondays at 7 pm",
  },
  {
    name: "Lantern",
    members: ["Ben Castellano", "Priya Raman", "Noor Haddad", "Jules Petit"],
    idea: "a shift-swap board for nurses on night rotation",
    users: "night-shift nurses at the teaching hospital",
    pain: "swaps happen over group texts, and the charge nurse finds out at the start of the shift",
    concepts: ["Shift", "Swap", "Approval"],
    meets: "Tuesdays after lab",
  },
  {
    name: "Quillwork",
    members: ["Leila Farouk", "Tomás Ibarra", "Wen Zhao"],
    idea: "a tool for writing groups to trade drafts and leave notes in the margins",
    users: "members of two campus writing groups",
    pain: "drafts go around by email and comments get lost between versions",
    concepts: ["Draft", "Margin note", "Round"],
    meets: "Wednesdays at noon",
  },
  {
    name: "Driftline",
    members: ["Hana Mori", "Oskar Lindgren", "Dev Malhotra", "Imani Cole"],
    idea: "a lost-and-found for the campus shuttle",
    users: "riders and drivers of the campus shuttle",
    pain: "a lost item sits in a bin at the depot and nobody knows it is there",
    concepts: ["Item", "Claim", "Route"],
    meets: "Thursdays at 5 pm",
  },
  {
    name: "Paperboat",
    members: ["Nadia Karim", "Theo Brandt", "Sunita Rao", "Caleb Wright"],
    idea: "a book swap between dorms",
    users: "residents of three dorms",
    pain: "people have shelves of books they have read and no easy way to pass them on",
    concepts: ["Listing", "Hold", "Handoff"],
    meets: "Sundays at 4 pm",
  },
  {
    name: "Halfmoon",
    members: ["Aiko Tanaka", "Rafael Mendes", "Zainab Yusuf"],
    idea: "a sleep diary that student athletes share with their trainers",
    users: "rowers on the varsity team and their trainers",
    pain: "trainers ask about sleep every morning and get guesses",
    concepts: ["Entry", "Streak", "Sharing"],
    meets: "Mondays at 9 pm",
  },
  {
    name: "Greenhouse",
    members: ["Elena Petrova", "Marcus Bell", "Yuki Sato", "Farah Aziz"],
    idea: "a watering schedule for the community garden",
    users: "gardeners with plots at the community garden",
    pain: "plants die in August when everyone assumes someone else watered",
    concepts: ["Plot", "Watering", "Harvest"],
    meets: "Saturdays at 10 am",
  },
  {
    name: "Sidecar",
    members: ["Jonas Weber", "Amara Nwosu", "Lucía Vega", "Kofi Mensah"],
    idea: "carpool matching for hospital staff who commute from the same towns",
    users: "hospital staff who drive in from the north shore",
    pain: "parking costs a day's lunch money and most cars carry one person",
    concepts: ["Ride", "Seat", "Rating"],
    meets: "Wednesdays at 6 pm",
  },
  {
    name: "Tinroof",
    members: ["Mina Park", "Daniel Osei", "Greta Holm"],
    idea: "a repair tracker for tenants in a housing co-op",
    users: "tenants and the maintenance committee of a housing co-op",
    pain: "requests are made in the hallway and forgotten by the weekend",
    concepts: ["Request", "Visit", "Thread"],
    meets: "Fridays at 3 pm",
  },
  {
    name: "Longtable",
    members: ["Ravi Shah", "Sofia Rossi", "Emeka Obi", "Clara Jung"],
    idea: "a potluck planner for a neighborhood association",
    users: "organizers of monthly neighborhood dinners",
    pain: "every dinner ends up with six salads and no main course",
    concepts: ["Dish", "Signup", "Reminder"],
    meets: "Tuesdays at 8 pm",
  },
  {
    name: "Fieldnote",
    members: ["Tariq Hassan", "Ines Duarte", "Viktor Novak", "Anh Tran"],
    idea: "an interview log for anthropology students doing fieldwork",
    users: "students in the fieldwork seminar",
    pain: "notes, recordings, and consent forms end up in three different places",
    concepts: ["Interview", "Tag", "Consent"],
    meets: "Thursdays at noon",
  },
  {
    name: "Windowseat",
    members: ["Chloe Martin", "Samir Patel", "Ruth Abebe"],
    idea: "a finder for open study seats in the library",
    users: "students who study in the main library",
    pain: "people walk all five floors looking for a seat near an outlet",
    concepts: ["Seat", "Check-in", "Quiet hours"],
    meets: "Mondays at 4 pm",
  },
  {
    name: "Northgate",
    members: ["Luca Bianchi", "Mei Chen", "Owen Hughes", "Dara Singh"],
    idea: "an organizer for pickup games at the rec center",
    users: "regulars at the rec center's evening games",
    pain: "games fall apart when two people don't show and nobody knows in time",
    concepts: ["Game", "Roster", "Court"],
    meets: "Sundays at 7 pm",
  },
  {
    name: "Solo Mapper",
    members: ["Kai Nakamura"],
    idea: "a map of step-free routes around campus",
    users: "students and staff who use wheelchairs or carry heavy gear",
    pain: "the official map shows buildings, not which doors have ramps or which elevators are out",
    concepts: ["Route", "Barrier", "Report"],
    meets: "Tuesdays and Fridays",
  },
];

/** The student on no team, and what he builds alone. */
const LONE = "Leo Marchetti";
const LONE_PROJECT: Project = {
  idea: "a booking tool for music practice rooms",
  users: "music students who need practice rooms",
  pain: "rooms are booked on a paper sheet and the good ones are gone by 8 am",
  concepts: ["Room", "Booking", "Waitlist"],
  meets: "Mondays and Thursdays",
};

const STAFF = [
  { name: "Dana Ingram", role: "course manager" },
  { name: "Noah Brandt", role: "grader" },
  { name: "Iris Vance", role: "grader" },
  { name: "Pablo Reyes", role: "grader" },
] as const;
const MANAGER_CAPABILITIES = ["course:manage", "grade", "student-records"];
const GRADER_CAPABILITIES = ["grade"];

/** Placed on a team, then dropped from the class. */
const DROPPED = "Imani Cole";
/** Moved to another team after a team grade was released. */
const MOVED = { name: "Zainab Yusuf", from: "Halfmoon", to: "Windowseat" };

// ---------------------------------------------------------------- the assignments

type Key = "pitch" | "contract" | "framing" | "critique" | "alpha" | "beta" | "exercise" | "prep";

interface AssignmentPlan {
  key: Key;
  title: string;
  kind: "FINAL_PROJECT" | "EXERCISE" | "PREP";
  submittedBy: "STUDENT" | "SECTION";
  instructions: string;
  /** Days ago it opened and fell due (negative: to come). */
  opens: number;
  due: number;
}

const ASSIGNMENTS: AssignmentPlan[] = [
  {
    key: "pitch",
    title: "Project pitch",
    kind: "FINAL_PROJECT",
    submittedBy: "STUDENT",
    instructions:
      "In a paragraph, pitch the project you want your team to build: whose problem it solves and what you would build first.",
    opens: 16,
    due: 9,
  },
  {
    key: "contract",
    title: "Team contract",
    kind: "FINAL_PROJECT",
    submittedBy: "STUDENT",
    instructions:
      "Write down how your team will work: when you meet, who owns what, and what happens when someone falls behind.",
    opens: 19,
    due: 12,
  },
  {
    key: "framing",
    title: "Problem framing",
    kind: "FINAL_PROJECT",
    submittedBy: "STUDENT",
    instructions:
      "Say whose problem your project solves, what you heard from them, and what you ruled out.",
    opens: 22,
    due: 15,
  },
  {
    key: "critique",
    title: "Design critique",
    kind: "FINAL_PROJECT",
    submittedBy: "SECTION",
    instructions:
      "Test one screen of your design with five people and say what you will change and what you will keep.",
    opens: 12,
    due: 5,
  },
  {
    key: "alpha",
    title: "Final project: alpha release",
    kind: "FINAL_PROJECT",
    submittedBy: "SECTION",
    instructions:
      "Deploy an alpha with your three core concepts and hand in the link, the concepts it includes, and a test account.",
    opens: 9,
    due: -2,
  },
  {
    key: "beta",
    title: "Final project: beta release",
    kind: "FINAL_PROJECT",
    submittedBy: "SECTION",
    instructions:
      "Deploy a beta with every concept working end to end, and a short report on what your first users did with it.",
    opens: 2,
    due: -16,
  },
  {
    key: "exercise",
    title: "Exercise 9",
    kind: "EXERCISE",
    submittedBy: "STUDENT",
    instructions:
      "Write two syncs between concepts you have built and say how you tested that each one fires.",
    opens: 10,
    due: 4,
  },
  {
    key: "prep",
    title: "Prep 21",
    kind: "PREP",
    submittedBy: "STUDENT",
    instructions:
      "Read the chapter on concept reuse and give one example of a concept two apps share.",
    opens: 5,
    due: 1,
  },
];
/** Papers are due at 10 pm. */
const DUE_HOUR = 22;

/** Who handed in each of the first three assignments, in days before the due date and hour. */
const EARLY: [name: string, before: number, hour: number][] = [
  ["Nadia Karim", 3, 10],
  ["Sam Okafor", 3, 14],
  ["Ben Castellano", 3, 20],
  ["Priya Raman", 2, 11],
  ["Maya Lindqvist", 2, 15],
  ["Hana Mori", 2, 19],
  ["Mina Park", 2, 21],
  ["Elena Petrova", 1, 12],
  ["Theo Brandt", 1, 16],
  ["Leo Marchetti", 1, 17],
  ["Wen Zhao", 1, 21],
  ["Aiko Tanaka", 0, 18],
  ["Jonas Weber", 0, 21],
];

/** The grades on each of the first three assignments, with feedback for each. */
const EARLY_GRADES: {
  name: string;
  score: number;
  released: boolean;
  feedback: Record<"pitch" | "contract" | "framing", string>;
}[] = [
  {
    name: "Sam Okafor",
    score: 9,
    released: true,
    feedback: {
      pitch: "A real problem for people you have met. Say what the first version leaves out.",
      contract: "Clear roles and a fair plan for missed meetings.",
      framing: "The volunteers' own words carry this. Say what you ruled out.",
    },
  },
  {
    name: "Ben Castellano",
    score: 9,
    released: true,
    feedback: {
      pitch: "The night-shift interviews make the need plain. Keep that voice in the proposal.",
      contract: "Specific and fair; the rule for busy weeks is a good idea.",
      framing: "Sharp framing: the design follows from the swap problem you describe.",
    },
  },
  {
    name: "Priya Raman",
    score: 6,
    released: true,
    feedback: {
      pitch: "This reads as a list of features. Start from whose problem it is and why it hurts.",
      contract: "Too general to settle a disagreement. Say who decides when you're split.",
      framing: "The problem is stated but not whose it is. Name the nurses you spoke with.",
    },
  },
  {
    name: "Wen Zhao",
    score: 8,
    released: false,
    feedback: {
      pitch:
        "Good idea, and the margin-note example helps. One writer's week would make it concrete.",
      contract: "Good meeting plan. Add what happens when a deadline slips.",
      framing: "Well grounded in the writing groups. The last paragraph drifts into features.",
    },
  },
  {
    name: "Hana Mori",
    score: 8,
    released: true,
    feedback: {
      pitch: "The shuttle numbers help. Say how a found item gets back to its owner.",
      contract: "Solid. Say how you'll split the work on the claim flow.",
      framing: "Clear and well grounded. Cut the second user group; it blurs the problem.",
    },
  },
  {
    name: "Leo Marchetti",
    score: 7,
    released: true,
    feedback: {
      pitch: "A real need. The waitlist rule is the interesting part, so lead with it.",
      contract: "Fine for working alone. Set yourself check-in dates and keep them.",
      framing: "The booking conflict is real. Show one evening when it went wrong.",
    },
  },
];

/** Who handed in each team's critique, and its released grade. */
const CRITIQUE: [team: string, by: string, score: number, feedback: string][] = [
  ["Tidepool", "Ada Ferreira", 9, "Good test plan, and you changed the right thing."],
  [
    "Lantern",
    "Noor Haddad",
    8,
    "Useful findings. Say which nurse found the approval step confusing.",
  ],
  ["Quillwork", "Tomás Ibarra", 7, "Five testers is right; tell us what each one tried to do."],
  ["Driftline", "Oskar Lindgren", 8, "Clear. The claim screen change follows from what you saw."],
  ["Paperboat", "Sunita Rao", 6, "You tested with teammates' friends only. Try three strangers."],
  ["Halfmoon", "Rafael Mendes", 9, "Careful and honest about what didn't work."],
  ["Greenhouse", "Marcus Bell", 7, "Good notes. The plan to keep Harvest needs a reason."],
  ["Sidecar", "Amara Nwosu", 10, "Excellent: each change ties to something a tester did."],
  ["Tinroof", "Daniel Osei", 8, "Solid. Add the one tenant who gave up and why."],
  [
    "Longtable",
    "Sofia Rossi",
    7,
    "Fine findings; the fixes are vague. Say what the button will say.",
  ],
  ["Fieldnote", "Ines Duarte", 9, "Thoughtful, especially the part about consent on phones."],
  ["Windowseat", "Samir Patel", 6, "Two testers isn't enough to decide. Run three more."],
  ["Northgate", "Mei Chen", 8, "Good. The roster change will help the late joiners."],
  ["Solo Mapper", "Kai Nakamura", 9, "Strong work alone; the barrier report test was well chosen."],
  [LONE, LONE, 7, "A fair test. Ask one more student who books at 8 am."],
];

/** The alpha attempts that came in, in days ago and hour. */
const ALPHA: [team: string, by: string, daysAgo: number, hour: number][] = [
  ["Quillwork", "Leila Farouk", 4, 20],
  ["Fieldnote", "Viktor Novak", 4, 22],
  ["Driftline", "Hana Mori", 3, 16],
  ["Paperboat", "Caleb Wright", 3, 18],
  ["Tinroof", "Greta Holm", 3, 21],
  ["Tidepool", "Sam Okafor", 2, 15],
  ["Halfmoon", "Aiko Tanaka", 2, 17],
  ["Greenhouse", "Yuki Sato", 2, 19],
  ["Tidepool", "Ada Ferreira", 1, 13],
  ["Sidecar", "Lucía Vega", 1, 14],
  ["Longtable", "Emeka Obi", 1, 16],
];

/** Students who did not hand in Exercise 9. */
const EXERCISE_MISSING = [
  "Imani Cole",
  "Jules Petit",
  "Caleb Wright",
  "Greta Holm",
  "Clara Jung",
  "Anh Tran",
  "Owen Hughes",
  "Dara Singh",
  "Ruth Abebe",
];
const PREP_COUNT = 20;
const PREP_SKIPPED = ["Maya Lindqvist", LONE, DROPPED];

// ---------------------------------------------------------------- papers

const slug = (name: string) => name.toLowerCase().replace(/\s+/g, "");

function pitchText(project: Project, position: number, alone: boolean) {
  const [one, two, three] = project.concepts;
  const start = [
    `I'd build ${one} first, since everything else hangs on it.`,
    `I'd start with ${two}; it's the part people asked about most.`,
    `The first thing to get right is ${three}, or nobody will trust the rest.`,
    `We could ship ${one} and ${two} in two weeks and learn a lot from it.`,
  ][position % 4];
  return `${alone ? "I want to build" : "I want our team to build"} ${project.idea}. I talked to ${project.users}: ${project.pain}. ${start}`;
}

function contractText(project: Project, position: number, alone: boolean) {
  if (alone)
    return `I'm working on my own, so this is a contract with myself: two work sessions a week, ${project.meets}, and a check-in with a TA before each deadline. If I miss a session I make it up that weekend.`;
  const owns = [
    "I'll keep the notes and the task list.",
    "I'll run our user tests and write them up.",
    "I'll handle deploys and the repository.",
    "I'll write up each design decision as we make it.",
  ][position % 4];
  return `We meet ${project.meets}. ${owns} We answer messages within a day and say early when we're behind. If someone misses two meetings in a row, we talk about it at the next one.`;
}

function framingText(project: Project, position: number) {
  const ruled = [
    "We ruled out a general chat app; it would hide the one thing people need to see.",
    "We're not solving scheduling in general, only this one handoff.",
    "We dropped the idea of a leaderboard after two people said it would make them quit.",
    "We left out payments; nobody we talked to wanted money involved.",
  ][position % 4];
  return `Our users are ${project.users}. The problem: ${project.pain}. ${ruled}`;
}

function critiqueText(project: Project) {
  const [one, two, three] = project.concepts;
  return `We tested the ${one} screen with five people. Three found it right away; two looked for it under ${two}. We're moving it to the first screen and renaming the button. We're keeping ${three} as it is: nobody had trouble with it.`;
}

function alphaText(team: string, project: Project) {
  const [one, two, three] = project.concepts;
  return `Alpha release: https://${slug(team)}.example.edu. Concepts in this release: ${one}, ${two}, and ${three}. ${one} and ${two} work end to end; ${three} saves but doesn't notify anyone yet. Test account: demo, password demo-${slug(team)}.`;
}

const ALPHA_AGAIN =
  "Alpha release, second try: https://tidepool.example.edu. We fixed the Survey page that crashed on an empty tide table. Concepts: Sighting, Survey, and Tide, all working end to end now. Test account: demo, password demo-tidepool.";

const EXERCISE_TEXTS = [
  "My two syncs connect posting and notifying: when a post is created in a thread, every follower gets a notice, and when a post is deleted, its notices go too. I tested each by following a thread from two accounts.",
  "I wrote a sync from Booking to Reminding so a reminder is set when a booking is made, and one that cancels it when the booking is cancelled. A test makes and cancels a booking and checks the reminder list.",
  "One sync starts a session when a user registers; the other ends every session when the password changes. I tested the second by signing in on two browsers and changing the password on one.",
  "My syncs tie Upvoting to Karma: an upvote adds a point to the author and removing it takes the point back. The test upvotes twice from one account and checks the second is refused.",
  "When an item is claimed, a sync closes its listing; when the claim is withdrawn, another reopens it. I checked both by hand and with a small test that claims and withdraws.",
];
const PREP_TEXTS = [
  "Upvoting is the same concept on a forum and a Q&A site: the state is who voted on what, and only the purpose of ranking differs.",
  "Both my bank app and my library app use a Hold concept: something is set aside for one person until a time runs out.",
  "Commenting shows up in a photo app and a code review tool with the same actions: add, edit, delete. Only what you comment on changes.",
  "Reservation is shared by a restaurant app and a gym app. The rules on cancelling differ, but the state is the same.",
];

// ---------------------------------------------------------------- what the seed returns

export interface SeededPerson {
  user: string;
  name: string;
  username: string;
  password: string;
  email: string;
  role: "course manager" | "grader" | "student";
  capabilities: string[];
  /** The team now, or null for staff and the student on no team. */
  team: string | null;
  /** A student placed on a team and then moved, or dropped from the class. */
  note: string | null;
}

export interface SeededTeams {
  origin: string;
  password: string;
  clock: "moved";
  term: { from: string; to: string };
  class: typeof KLASS;
  accounts: SeededPerson[];
  teams: { name: string; section: string; members: string[] }[];
  assignments: {
    key: Key;
    assignment: string;
    title: string;
    kind: string;
    submittedBy: "STUDENT" | "SECTION";
    availableAt: string;
    dueAt: string;
    path: string;
  }[];
  notes: string[];
  calls: number;
}

// ---------------------------------------------------------------- seeding

interface Person extends Session {
  name: string;
  username: string;
  email: string;
}

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** The first name, or the first name and last initial when the first is taken. */
async function freeUsername(api: Api, admin: Session, name: string, taken: Set<string>) {
  const parts = plain(name).split(" ");
  const candidates = [parts[0] as string, `${parts[0]}${(parts.at(-1) as string)[0]}`];
  for (const username of candidates) {
    if (taken.has(username)) continue;
    const { user } = await api.call<{ user: string | null }>(admin, "/auth/resolve", { username });
    if (user === null) return username;
  }
  throw new Error(`No free username for ${name}: ${candidates.join(", ")} are taken`);
}

async function createPerson(api: Api, admin: Session, name: string, username: string) {
  const email = `${plain(name).replace(/\s+/g, ".")}@example.edu`;
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
  return (await api.call<{ role: string }>(admin, "/roles/define", { name, capabilities })).role;
}

interface Entry {
  id: string;
  plan: AssignmentPlan;
  criterion: string;
  revision: number;
  draft: Record<string, unknown>;
}

export interface TeamScenarioOptions {
  /** Called with a short line as each phase ends. */
  progress?: (line: string) => void;
}

/**
 * Seed the class through an edge in this process, over the database the
 * running stack at `origin` reads, moving the clock to each moment as it goes.
 */
export async function seedTeamScenario(
  mongodbUrl: string,
  origin: string,
  options: TeamScenarioOptions = {},
): Promise<SeededTeams> {
  const started = Date.now();
  const progress = (line: string) =>
    options.progress?.(`${((Date.now() - started) / 1000).toFixed(1)}s ${line}`);
  origin = origin.replace(/\/$/, "");
  const edge = await openClockedEdge(mongodbUrl, origin);
  try {
    const api = new Api(origin, edge.transport);
    const calendar = new Calendar(KLASS.timezone, started);
    const from = calendar.at(24, 9);
    await edge.travel(from);
    const admin = await api.login("mara");

    // People: usernames are first names unless taken.
    const studentNames = [...TEAMS.flatMap((team) => team.members), LONE];
    const names = [...STAFF.map((staff) => staff.name), ...studentNames];
    const taken = new Set<string>();
    const usernames = new Map<string, string>();
    for (const name of names) {
      const username = await freeUsername(api, admin, name, taken);
      taken.add(username);
      usernames.set(name, username);
    }

    // The class and its teams.
    try {
      await api.call(admin, "/roster/configure-class", KLASS);
    } catch {
      await api.call(admin, "/roster/update-class", KLASS);
    }
    const sections = new Map<string, string>();
    for (const team of TEAMS) {
      const created = await api.call<{ section: { _id: string } | string }>(
        admin,
        "/roster/sections/create",
        { name: team.name, location: "", meetingPattern: "" },
      );
      sections.set(
        team.name,
        typeof created.section === "string" ? created.section : created.section._id,
      );
    }

    // Accounts, staff roles, and the roster.
    const created = await pool(names, CONCURRENCY, (name) =>
      createPerson(api, admin, name, usernames.get(name) as string),
    );
    const people = new Map(created.map((person) => [person.name, person]));
    const person = (name: string) => {
      const found = people.get(name);
      if (!found) throw new Error(`No account for ${name}`);
      return found;
    };
    const [managerRole, graderRole] = await Promise.all([
      ensureRole(api, admin, "Course manager", MANAGER_CAPABILITIES),
      ensureRole(api, admin, "Course grader", GRADER_CAPABILITIES),
    ]);
    for (const staff of STAFF)
      await api.call(admin, "/roles/assign", {
        user: person(staff.name).user,
        context: "commons",
        role: staff.role === "course manager" ? managerRole : graderRole,
      });
    const teamOf = new Map<string, string | null>([[LONE, null]]);
    for (const team of TEAMS) for (const member of team.members) teamOf.set(member, team.name);
    await api.call(admin, "/roster/import", {
      rows: studentNames.map((name) => {
        const team = teamOf.get(name);
        return {
          email: person(name).email,
          kind: "STUDENT",
          ...(team ? { section: sections.get(team) } : {}),
          displayName: name,
        };
      }),
    });
    await edge.travel(edge.now());
    const roster = await api.call<{ members: { user: string; seat: string; status?: string }[] }>(
      admin,
      "/roster/list",
    );
    const seatOf = (name: string) => {
      const seat = roster.members.find((row) => row.user === person(name).user)?.seat;
      if (!seat) throw new Error(`${name} holds no seat`);
      return seat;
    };
    for (const name of studentNames) seatOf(name);
    progress(
      `people: ${studentNames.length} students on ${TEAMS.length} teams, ${STAFF.length} staff`,
    );

    const dana = person("Dana Ingram");
    const graders = ["Noah Brandt", "Iris Vance", "Pablo Reyes"].map(person);
    const assignments = new Map<Key, Entry>();
    const entry = (key: Key) => assignments.get(key) as Entry;
    const projectOf = (name: string): Project => {
      const team = teamOf.get(name);
      return TEAMS.find((plan) => plan.name === team) ?? LONE_PROJECT;
    };
    const positionOf = (name: string) => {
      const team = TEAMS.find((plan) => plan.members.includes(name));
      return team ? team.members.indexOf(name) : 0;
    };
    /** Who grades each student's or team's work, by assignment and name. */
    const graderOf = new Map<string, Person>();

    const submit = async (key: Key, name: string, content: string) => {
      const { submission } = await api.call<{ submission: string }>(
        person(name),
        "/assignments/submit",
        { assignment: entry(key).id, content },
      );
      return submission;
    };
    const assess = async (
      key: Key,
      grader: Person,
      learner: string,
      evidence: string,
      score: number,
      feedback: string,
      release: boolean,
    ) => {
      const target = entry(key);
      const recorded = await api.call<{ grade: string; version: number }>(
        grader,
        "/grades/record",
        { learner: person(learner).user, item: target.id, evidence, revision: target.revision },
      );
      const saved = await api.call<{ grade: string; version: number }>(grader, "/grades/save", {
        grade: recorded.grade,
        version: recorded.version,
        judgments: [{ kind: "POINTS", criterion: target.criterion, score }],
        feedback,
      });
      if (release)
        await api.call(grader, "/grades/release", {
          grade: recorded.grade,
          version: saved.version,
        });
    };

    const steps: { at: number; run: () => Promise<void> }[] = [];

    // Each assignment opens, published with a ten-point setup and its graders named.
    for (const plan of ASSIGNMENTS)
      steps.push({
        at: calendar.at(plan.opens, 9),
        run: async () => {
          const draft = {
            title: plan.title,
            instructions: plan.instructions,
            kind: plan.kind,
            availableAt: new Date(calendar.at(plan.opens, 9)).toISOString(),
            dueAt: new Date(calendar.at(plan.due, DUE_HOUR)).toISOString(),
            acceptsSubmissions: true,
            audience: "EVERYONE",
            submittedBy: plan.submittedBy,
          };
          const { assignment } = await api.call<{ assignment: string }>(
            dana,
            "/assignments/create-draft",
            draft,
          );
          const setup = await api.call<{ revision: number; criteria: { criterion: string }[] }>(
            dana,
            "/grades/configure-setup",
            {
              item: assignment,
              method: "POINTS",
              revision: 0,
              criteria: [{ kind: "POINTS", name: "Overall", maxPoints: 10, position: 0 }],
            },
          );
          await api.call(dana, "/assignments/publish", { assignment });
          const criterion = setup.criteria[0]?.criterion;
          if (!criterion) throw new Error(`${plan.title}: no criterion in its setup`);
          assignments.set(plan.key, {
            id: assignment,
            plan,
            criterion,
            revision: setup.revision,
            draft,
          });
          await edge.travel(edge.now());
          // Each student's paper, or each team's, goes to a grader in turn.
          const learners =
            plan.submittedBy === "STUDENT"
              ? studentNames.filter((name) => name !== DROPPED || plan.opens > 6)
              : [...TEAMS.map((team) => team.members[0] as string), LONE];
          const team = plan.key === "alpha" ? [...graders, dana] : graders;
          await pool(learners, CONCURRENCY, async (name, index) => {
            const grader = team[index % team.length] as Person;
            graderOf.set(`${plan.key}:${teamOf.get(name) ?? name}:${name}`, grader);
            await api.call(dana, "/delegation/set", {
              item: assignment,
              learner: person(name).user,
              grader: grader.user,
            });
          });
        },
      });
    const individualGrader = (key: Key, name: string) =>
      graderOf.get(`${key}:${teamOf.get(name) ?? name}:${name}`) as Person;
    const teamGrader = (key: Key, team: string) => {
      const lead = TEAMS.find((plan) => plan.name === team)?.members[0] ?? team;
      return graderOf.get(`${key}:${teamOf.get(lead) ?? lead}:${lead}`) as Person;
    };

    // The first three: each student hands in, graders grade a few.
    const papers = new Map<string, string>();
    for (const key of ["framing", "contract", "pitch"] as const) {
      const plan = ASSIGNMENTS.find((item) => item.key === key) as AssignmentPlan;
      for (const [name, before, hour] of EARLY)
        steps.push({
          at: calendar.at(plan.due + before, hour),
          run: async () => {
            const project = projectOf(name);
            const alone =
              (TEAMS.find((team) => team.members.includes(name))?.members.length ?? 1) === 1;
            const text =
              key === "pitch"
                ? pitchText(project, positionOf(name), alone)
                : key === "contract"
                  ? contractText(project, positionOf(name), alone)
                  : framingText(project, positionOf(name));
            papers.set(`${key}:${name}`, await submit(key, name, text));
          },
        });
      steps.push({
        at: calendar.at(plan.due - 1, 10),
        run: async () => {
          for (const grade of EARLY_GRADES)
            await assess(
              key,
              individualGrader(key, grade.name),
              grade.name,
              papers.get(`${key}:${grade.name}`) as string,
              grade.score,
              grade.feedback[key],
              grade.released,
            );
        },
      });
      if (key !== "pitch")
        steps.push({
          at: calendar.at(plan.due - 2, 11),
          run: async () => {
            const target = entry(key);
            target.draft.submittedBy = "SECTION";
            await api.call(dana, "/assignments/revise", { ...target.draft, assignment: target.id });
            await edge.travel(edge.now());
            if (key === "framing")
              await api.call(dana, "/submissions/move-to-sections", { assignment: target.id });
          },
        });
    }

    // Exercise 9 and Prep 21: each student's own.
    const handedExercise = studentNames.filter((name) => !EXERCISE_MISSING.includes(name));
    for (const [index, name] of handedExercise.entries())
      steps.push({
        at: calendar.at(4 + (index % 3), 9 + (index % 12), (index * 7) % 60),
        run: async () => {
          await submit("exercise", name, EXERCISE_TEXTS[index % EXERCISE_TEXTS.length] as string);
        },
      });
    const handedPrep = studentNames
      .filter((name) => !PREP_SKIPPED.includes(name))
      .filter((_, index) => index % 2 === 0)
      .slice(0, PREP_COUNT);
    for (const [index, name] of handedPrep.entries())
      steps.push({
        at: calendar.at(1 + (index % 3), 8 + (index % 13), (index * 11) % 60),
        run: async () => {
          await submit("prep", name, PREP_TEXTS[index % PREP_TEXTS.length] as string);
        },
      });

    // Imani leaves the class.
    steps.push({
      at: calendar.at(6, 8),
      run: async () => {
        await api.call(admin, "/roster/drop", { seat: seatOf(DROPPED) });
      },
    });

    // The design critique: each team once, all released; then Zainab changes teams.
    const critiques = new Map<string, string>();
    for (const [position, [team, by]] of CRITIQUE.entries())
      steps.push({
        at: calendar.at(5 + (position % 3), 10 + (position % 11)),
        run: async () => {
          const project = projectOf(by);
          critiques.set(team, await submit("critique", by, critiqueText(project)));
        },
      });
    steps.push({
      at: calendar.at(3, 10),
      run: async () => {
        for (const [team, by, score, feedback] of CRITIQUE)
          await assess(
            "critique",
            team === LONE ? individualGrader("critique", LONE) : teamGrader("critique", team),
            by,
            critiques.get(team) as string,
            score,
            feedback,
            true,
          );
      },
    });
    steps.push({
      at: calendar.at(3, 16),
      run: async () => {
        await api.call(admin, "/roster/move-section", {
          seat: seatOf(MOVED.name),
          section: sections.get(MOVED.to),
        });
        teamOf.set(MOVED.name, MOVED.to);
      },
    });

    // The alpha: attempts as they came, Driftline's released, Tidepool's drafted, Lantern given more time.
    const alphas = new Map<string, string>();
    for (const [team, by, daysAgo, hour] of ALPHA)
      steps.push({
        at: calendar.at(daysAgo, hour),
        run: async () => {
          const again = alphas.has(team);
          alphas.set(
            team,
            await submit("alpha", by, again ? ALPHA_AGAIN : alphaText(team, projectOf(by))),
          );
        },
      });
    const alphaPlan = ASSIGNMENTS.find((item) => item.key === "alpha") as AssignmentPlan;
    const lanternDue = calendar.at(alphaPlan.due - 3, DUE_HOUR);
    steps.push({
      at: calendar.at(1, 11),
      run: async () => {
        await assess(
          "alpha",
          teamGrader("alpha", "Driftline"),
          "Hana Mori",
          alphas.get("Driftline") as string,
          8,
          "All three concepts work. Claims don't tell the finder yet, so say when they will.",
          true,
        );
        await api.call(dana, "/assignments/set-due-override", {
          assignment: entry("alpha").id,
          assignee: person("Ben Castellano").user,
          dueAt: new Date(lanternDue).toISOString(),
        });
      },
    });
    steps.push({
      at: calendar.at(1, 19),
      run: async () => {
        const noah = person("Noah Brandt");
        if (teamGrader("alpha", "Tidepool") !== noah)
          throw new Error("Tidepool's alpha is not delegated to Noah Brandt");
        await assess(
          "alpha",
          noah,
          "Maya Lindqvist",
          alphas.get("Tidepool") as string,
          9,
          "Works end to end now. The Survey page still needs a message when there is nothing to show.",
          false,
        );
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

    const notes = [
      `Seeded on a moved clock from ${new Date(from).toISOString()} to ${new Date(to).toISOString()}, through an edge in the seed's process over the stack's database; the stack reads it back from there.`,
      `${DROPPED}'s seat on Driftline is dropped. ${MOVED.name} moved from ${MOVED.from} to ${MOVED.to} after the design critique grades were released.`,
      `Lantern's alpha is due ${new Date(lanternDue).toISOString()}, three days after the other teams.`,
    ];
    if (edge.overruns.count > 0)
      notes.push(
        `${edge.overruns.count} moments were already past when the seed reached them, by at most ${(edge.overruns.maxMs / 1000).toFixed(1)} s; those actions were stamped that much later.`,
      );
    return {
      origin,
      password: PASSWORD,
      clock: "moved",
      term: { from: new Date(from).toISOString(), to: new Date(to).toISOString() },
      class: KLASS,
      accounts: names.map((name) => {
        const account = person(name);
        const staff = STAFF.find((entry) => entry.name === name);
        return {
          user: account.user,
          name,
          username: account.username,
          password: PASSWORD,
          email: account.email,
          role: staff ? staff.role : "student",
          capabilities: staff
            ? staff.role === "course manager"
              ? MANAGER_CAPABILITIES
              : GRADER_CAPABILITIES
            : [],
          team: staff ? null : (teamOf.get(name) ?? null),
          note:
            name === DROPPED
              ? "dropped from the class after being placed on Driftline"
              : name === MOVED.name
                ? `moved from ${MOVED.from} to ${MOVED.to} after the design critique was released`
                : name === LONE
                  ? "on no team"
                  : null,
        };
      }),
      teams: TEAMS.map((team) => ({
        name: team.name,
        section: sections.get(team.name) as string,
        members: studentNames.filter((name) => teamOf.get(name) === team.name && name !== DROPPED),
      })),
      assignments: ASSIGNMENTS.map((plan) => ({
        key: plan.key,
        assignment: entry(plan.key).id,
        title: plan.title,
        kind: plan.kind,
        submittedBy: entry(plan.key).draft.submittedBy as "STUDENT" | "SECTION",
        availableAt: new Date(calendar.at(plan.opens, 9)).toISOString(),
        dueAt: new Date(calendar.at(plan.due, DUE_HOUR)).toISOString(),
        path: `/staff/assignments/${entry(plan.key).id}`,
      })),
      notes,
      calls: api.calls,
    };
  } finally {
    await edge.close();
  }
}

// ---------------------------------------------------------------- checks

export interface TeamChecks {
  passed: string[];
  failed: string[];
}

interface GradeRow {
  grade: string;
  learner: string;
  evidence: string;
  status: string;
  score: number;
  feedback: string;
  attempt?: number;
}

/** Read the class back over HTTP from the running stack and compare it with what was seeded. */
export async function checkTeamScenario(seeded: SeededTeams): Promise<TeamChecks> {
  const api = new Api(seeded.origin.replace(/\/$/, ""));
  const account = (name: string) => {
    const found = seeded.accounts.find((entry) => entry.name === name);
    if (!found) throw new Error(`No seeded account for ${name}`);
    return found;
  };
  const id = (key: Key) =>
    (seeded.assignments.find((entry) => entry.key === key) as { assignment: string }).assignment;
  const section = (team: string) =>
    (seeded.teams.find((entry) => entry.name === team) as { section: string }).section;
  const dana = await api.login(account("Dana Ingram").username);
  const passed: string[] = [];
  const failed: string[] = [];
  const expect = (label: string, ok: boolean, found: unknown) => {
    if (ok) passed.push(label);
    else failed.push(`${label}: found ${JSON.stringify(found)}`);
  };

  const page = (key: Key) =>
    api.call<{
      assigned: { assignee: string; submitter: string; dueOverride: string | null }[];
      submissions: { submitter: string; submission: string }[];
      unmoved: { student: string; section: string; submission: string }[];
    }>(dana, "/submissions/for-assignment", { assignment: id(key) });
  const grades = async (key: Key) =>
    (await api.call<{ grades: GradeRow[] }>(dana, "/grades/for-item", { item: id(key) })).grades;
  const attempts = async (key: Key, name: string) =>
    (
      await api.call<{ attempts: { submission: string; number: number }[] }>(
        dana,
        "/submissions/attempts",
        { assignment: id(key), submitter: account(name).user },
      )
    ).attempts;
  const statuses = (rows: GradeRow[]) => rows.map((row) => `${row.status}:${row.score}`).sort();

  const { assignments } = await api.call<{ assignments: { title: string }[] }>(
    dana,
    "/assignments/staff-list",
  );
  const titles = assignments.map((row) => row.title);
  expect(
    "every assignment is listed for staff",
    seeded.assignments.every((entry) => titles.includes(entry.title)),
    titles,
  );

  const pitch = await page("pitch");
  expect("Project pitch has 13 papers", pitch.submissions.length === 13, pitch.submissions.length);
  expect("Project pitch has nothing to move", pitch.unmoved.length === 0, pitch.unmoved.length);
  const pitchGrades = await grades("pitch");
  expect(
    "Project pitch has five released grades and one draft",
    JSON.stringify(statuses(pitchGrades)) ===
      JSON.stringify(
        ["RELEASED:9", "RELEASED:9", "RELEASED:6", "DRAFT:8", "RELEASED:8", "RELEASED:7"].sort(),
      ),
    statuses(pitchGrades),
  );
  expect(
    "every grade has feedback",
    pitchGrades.every((row) => row.feedback.length > 0),
    pitchGrades.map((row) => row.feedback),
  );

  const contract = await page("contract");
  expect(
    "Team contract offers 12 attempts to move",
    contract.unmoved.length === 12,
    contract.unmoved.length,
  );
  const contractSections = new Set(contract.unmoved.map((row) => row.section));
  expect(
    "Team contract's attempts fall on 9 teams",
    contractSections.size === 9,
    contractSections.size,
  );

  const framing = await page("framing");
  expect(
    "Problem framing has nothing left to move",
    framing.unmoved.length === 0,
    framing.unmoved.length,
  );
  const framingGrades = await grades("framing");
  const lantern = framingGrades.filter((row) => row.learner === section("Lantern"));
  expect(
    "Problem framing's Lantern holds two drafts that differ",
    JSON.stringify(statuses(lantern)) === JSON.stringify(["DRAFT:6", "DRAFT:9"]),
    statuses(lantern),
  );
  const tidepoolFraming = await attempts("framing", "Maya Lindqvist");
  const tidepoolGrades = framingGrades.filter((row) => row.learner === section("Tidepool"));
  expect(
    "Problem framing's Tidepool has a draft on attempt 1 and an ungraded attempt 2",
    tidepoolFraming.map((row) => row.number).join(",") === "1,2" &&
      tidepoolGrades.length === 1 &&
      tidepoolGrades[0]?.status === "DRAFT" &&
      tidepoolGrades[0]?.evidence === tidepoolFraming[0]?.submission,
    { attempts: tidepoolFraming.map((row) => row.number), grades: statuses(tidepoolGrades) },
  );

  const critiqueGrades = await grades("critique");
  expect(
    "Design critique has 15 released grades",
    critiqueGrades.length === 15 && critiqueGrades.every((row) => row.status === "RELEASED"),
    statuses(critiqueGrades),
  );
  const zainab = await api.login(account("Zainab Yusuf").username);
  const mine = (
    await api.call<{ grades: { item: string; grade: string; score: number }[] }>(
      zainab,
      "/grades/for-me",
    )
  ).grades.filter((row) => row.item === id("critique"));
  const windowseat = critiqueGrades.find((row) => row.learner === section("Windowseat"));
  expect(
    "Zainab reads Windowseat's design critique grade",
    mine.length === 1 && mine[0]?.grade === windowseat?.grade && mine[0]?.score === 6,
    mine,
  );

  const alpha = await page("alpha");
  expect("the alpha has 11 attempts", alpha.submissions.length === 11, alpha.submissions.length);
  const mayas = await attempts("alpha", "Maya Lindqvist");
  expect("Maya's attempts on the alpha number 2", mayas.length === 2, mayas.length);
  const alphaGrades = await grades("alpha");
  expect(
    "the alpha has Tidepool's draft and Driftline's release",
    alphaGrades.find((row) => row.learner === section("Tidepool"))?.status === "DRAFT" &&
      alphaGrades.find((row) => row.learner === section("Driftline"))?.status === "RELEASED" &&
      alphaGrades.length === 2,
    statuses(alphaGrades),
  );
  const lanternMembers = ["Ben Castellano", "Priya Raman", "Noor Haddad", "Jules Petit"].map(
    (name) => account(name).user,
  );
  const overrides = alpha.assigned.filter((row) => lanternMembers.includes(row.assignee));
  expect(
    "every Lantern member reads the alpha's due override",
    overrides.length === 4 && overrides.every((row) => Boolean(row.dueOverride)),
    overrides.map((row) => row.dueOverride),
  );

  const beta = await page("beta");
  expect("nobody has handed in the beta", beta.submissions.length === 0, beta.submissions.length);

  const exercise = await page("exercise");
  const exerciseBy = new Set(exercise.submissions.map((row) => row.submitter));
  expect(
    "Exercise 9 has 40 papers, Maya's and Leo's among them",
    exercise.submissions.length === 40 &&
      exerciseBy.has(account("Maya Lindqvist").user) &&
      exerciseBy.has(account(LONE).user),
    exercise.submissions.length,
  );
  const prep = await page("prep");
  const prepBy = new Set(prep.submissions.map((row) => row.submitter));
  expect(
    "Prep 21 has 20 papers, not Maya's or Leo's",
    prep.submissions.length === PREP_COUNT &&
      !prepBy.has(account("Maya Lindqvist").user) &&
      !prepBy.has(account(LONE).user),
    prep.submissions.length,
  );

  const dropped = await api.call<{ members: { user: string }[] }>(dana, "/roster/dropped");
  const droppedUsers = dropped.members.map((row) => row.user);
  expect("Imani's seat is dropped", droppedUsers.includes(account(DROPPED).user), droppedUsers);

  return { passed, failed };
}

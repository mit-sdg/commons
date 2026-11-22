import { createEdge } from "../../src/edge.ts";
import { createCommonsFixture } from "./fixtures.ts";

type Edge = ReturnType<typeof createEdge>;

export const post = async (
  edge: Edge,
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; body: Record<string, unknown> }> => {
  const response = await edge.fetch(
    new Request(`http://commons.test/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie === undefined ? {} : { Cookie: cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
};

const login = async (edge: Edge, username: string) => {
  const response = await edge.fetch(
    new Request("http://commons.test/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "password123" }),
    }),
  );
  return response.headers.get("set-cookie")?.split(";")[0] as string;
};

const register = async (edge: Edge, username: string, displayName: string) => {
  const made = await edge.application.concepts.Authenticating.register({
    username,
    password: "password123",
    email: `${username}@example.edu`,
  });
  await edge.application.concepts.Profiling.createProfile({ user: made.user, displayName });
  await edge.application.whenIdle();
  return { user: made.user, username, cookie: await login(edge, username) };
};

export const assignmentFields = {
  instructions: "Hand in your work.",
  kind: "PROJECT",
  availableAt: "2020-01-01T00:00:00Z",
  dueAt: "2090-01-01T00:00:00Z",
  acceptsSubmissions: true,
  audience: "EVERYONE",
  targets: [],
};

/**
 * A class with two sections used as teams and two published assignments. Dana
 * administers and Noah grades, neither enrolled. Sam, Maya, and Ada are in the
 * first section and Ben in the second; Leo is in none. Priya is in the second
 * section and also holds `grade`. The project is submitted by each section,
 * the exercise by each student.
 */
export const buildTeamClassroom = async () => {
  const { db, edge, resetEdge } = await createCommonsFixture();
  const dana = await register(edge, "dana", "Dana Ingram");
  const noah = await register(edge, "noah", "Noah Brandt");
  const sam = await register(edge, "sam", "Sam Okafor");
  const maya = await register(edge, "maya", "Maya Lindqvist");
  const ada = await register(edge, "ada", "Ada Ferreira");
  const ben = await register(edge, "ben", "Ben Castellano");
  const leo = await register(edge, "leo", "Leo Marchetti");
  const priya = await register(edge, "priya", "Priya Raman");

  await post(
    edge,
    "/roster/configure-class",
    { code: "6.1040", title: "Software Design", term: "Fall 2026", timezone: "America/New_York" },
    dana.cookie,
  );
  const section = async (name: string) =>
    String(
      (
        (
          await post(
            edge,
            "/roster/sections/create",
            { name, location: "", meetingPattern: "" },
            dana.cookie,
          )
        ).body.section as { _id: string }
      )._id,
    );
  const first = await section("Tidepool");
  const second = await section("Lantern");
  for (const [student, place] of [
    [sam, first],
    [maya, first],
    [ada, first],
    [ben, second],
    [priya, second],
    [leo, null],
  ] as const) {
    await post(
      edge,
      "/roster/add-person",
      {
        email: `${student.username}@example.edu`,
        kind: "STUDENT",
        ...(place === null ? {} : { section: place }),
        displayName: "student",
      },
      dana.cookie,
    );
  }
  const graderRole = String(
    (
      await post(
        edge,
        "/roles/define",
        { name: "teaching assistant", capabilities: ["grade"] },
        dana.cookie,
      )
    ).body.role,
  );
  for (const grader of [noah, priya]) {
    await post(
      edge,
      "/roles/assign",
      { user: `${grader.username}@example.edu`, context: "commons", role: graderRole },
      dana.cookie,
    );
  }
  const publish = async (title: string, submittedBy: "STUDENT" | "SECTION") => {
    const assignment = String(
      (
        await post(
          edge,
          "/assignments/create-draft",
          { ...assignmentFields, title, submittedBy },
          dana.cookie,
        )
      ).body.assignment,
    );
    await post(edge, "/assignments/publish", { assignment }, dana.cookie);
    return assignment;
  };
  const project = await publish("Final project", "SECTION");
  const exercise = await publish("Exercise 1", "STUDENT");
  await edge.application.whenIdle();

  const seatOf = async (user: string) => {
    const roster = (await post(edge, "/roster/list", {}, dana.cookie)).body.members as {
      user: string;
      seat: string;
    }[];
    return String(roster.find((row) => row.user === user)?.seat);
  };
  const submit = async (assignment: string, student: { cookie: string }, content: string) => {
    const result = await post(edge, "/assignments/submit", { assignment, content }, student.cookie);
    await edge.application.whenIdle();
    return String(result.body.submission);
  };

  return {
    db,
    edge,
    resetEdge,
    dana,
    noah,
    sam,
    maya,
    ada,
    ben,
    leo,
    priya,
    first,
    second,
    project,
    exercise,
    seatOf,
    submit,
  };
};

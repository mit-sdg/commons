import { createCommonsFixture } from "../support/fixtures.ts";
import { stopTestDb } from "../../src/concepts/testing.ts";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { createEdge } from "../../src/edge.ts";
import { lectureAttendance, type LectureRun } from "../../src/computations/lectures.ts";

type Edge = ReturnType<typeof createEdge>;
type Body = Record<string, unknown>;

afterAll(stopTestDb);

const post = (edge: Edge, path: string, body: unknown, cookie?: string) =>
  edge.fetch(
    new Request(`http://edge/api${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie !== undefined ? { Cookie: cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

interface Attendance {
  timezone: string | null;
  students: { user: string; section: string | null; displayName: string | null }[];
  runs: LectureRun[];
}

describe("lecture attendance", () => {
  let edge: Edge;
  const cookies: Record<string, string> = {};
  const users: Record<string, string> = {};
  const call = async (who: string, path: string, body: Body = {}) =>
    (await (await post(edge, path, body, cookies[who])).json()) as Body;

  async function person(name: string, capabilities: string[] | "student") {
    const concepts = edge.application.concepts;
    const password = `pw-${name}-123`;
    const { user } = await concepts.Authenticating.register({
      username: name,
      password,
      email: `${name}@example.com`,
    });
    await concepts.Profiling.createProfile({ user, displayName: name });
    if (capabilities === "student") {
      await concepts.Rostering.enrol({
        user,
        email: `${name}@example.com`,
        kind: "STUDENT",
        section: null,
      });
    } else {
      const { role } = await concepts.Roling.ensureRole({ name: `${name}-role`, capabilities });
      await concepts.Roling.assign({ user, context: "commons", role });
    }
    const login = await post(edge, "/auth/login", { username: name, password });
    cookies[name] = login.headers.get("Set-Cookie")?.split(";")[0] as string;
    users[name] = user;
  }

  async function quizRun(title: string) {
    const { questionnaire } = await call("host", "/live/quizzes/create", { title, form: "survey" });
    await call("host", "/live/quizzes/add-question", {
      questionnaire,
      prompt: "How is the pace?",
      choices: ["Slow", "Right"],
      expected: "",
      explanation: "",
    });
    const { run, token } = await call("host", "/live/runs/launch", { questionnaire });
    return { run: run as string, token: token as string };
  }

  const attendance = async (who: string) =>
    (await call(who, "/live/lectures/attendance")) as unknown as Attendance;

  const presentAt = async (who: string) => {
    await edge.application.whenIdle();
    const read = await attendance(who);
    return lectureAttendance({
      runs: read.runs,
      students: read.students.map((student) => student.user),
      timezone: read.timezone,
    });
  };

  beforeAll(async () => {
    edge = (await createCommonsFixture()).edge;
    await person("host", ["live:host"]);
    await person("grader", ["grade"]);
    await person("ana", "student");
    await person("ben", "student");
    await edge.application.concepts.Rostering.configureClass({
      code: "6.1040",
      title: "Software Design",
      term: "Fall 2026",
      timezone: "America/New_York",
    });
  });

  test("a student who joined two runs of one date counts once, and only joiners count", async () => {
    const first = await quizRun("Warm-up");
    const second = await quizRun("Exit ticket");
    // Ana joins the first run from two devices and the second run once.
    await call("ana", "/live/p/begin-signed", { token: first.token });
    await call("ana", "/live/p/begin-signed", { token: first.token });
    await call("ana", "/live/p/begin-signed", { token: second.token });
    // Ben opens the code but never taps Join.
    await post(edge, "/live/p/arrive", { token: first.token });
    // A phone joins without signing in, and the model takes a seat.
    await post(edge, "/live/p/begin", { token: first.token, device: "phone-1" });
    await post(edge, "/live/p/begin", { token: second.token, device: "phone-1" });
    await call("host", "/live/runs/invite", { run: first.run, device: "seat-1" });
    await edge.application.whenIdle();
    await call("host", "/live/runs/close", { run: first.run });
    await call("host", "/live/runs/close", { run: second.run });

    // Marked after it closed, and marked twice without harm.
    expect(await call("host", "/live/lectures/mark", { run: first.run })).toEqual({
      run: first.run,
      lecture: true,
    });
    expect(await call("host", "/live/lectures/mark", { run: first.run })).toEqual({
      run: first.run,
      lecture: true,
    });
    await call("host", "/live/lectures/mark", { run: second.run });

    // A grader without course:manage reads the grid.
    const { lectures, attended } = await presentAt("grader");
    expect(lectures).toHaveLength(1);
    expect(lectures[0]!.runs.map((run) => run.run).sort()).toEqual([first.run, second.run].sort());
    expect(lectures[0]!.present).toEqual([users.ana]);
    expect(lectures[0]!.signedOut).toBe(1);
    expect(attended.get(users.ana!)!.size).toBe(1);
    expect(attended.get(users.ben!)!.size).toBe(0);

    // Unmarking removes a run at once, and unmarking twice is harmless.
    await call("host", "/live/lectures/unmark", { run: second.run });
    expect(await call("host", "/live/lectures/unmark", { run: second.run })).toEqual({
      run: second.run,
      lecture: false,
    });
    const after = await presentAt("grader");
    expect(after.lectures[0]!.runs.map((run) => run.run)).toEqual([first.run]);
    await call("host", "/live/lectures/unmark", { run: first.run });
  });

  test("a relay counts a response to any of its rounds", async () => {
    const { relay } = await call("host", "/live/relays/plan", { title: "Design studio" });
    const legs: string[] = [];
    for (const title of ["First", "Second"]) {
      const { leg } = await call("host", "/live/relays/add-round", {
        relay,
        title,
        prompt: `${title}?`,
        parts: [],
        cap: 0,
        choices: [],
      });
      legs.push(leg as string);
    }
    const { run, token } = await call("host", "/live/relays/launch", { relay });
    await call("host", "/live/relays/open-round", { run, leg: legs[0] });
    await call("host", "/live/relays/close-round", { run });
    await call("host", "/live/relays/open-round", { run, leg: legs[1] });
    // Ben arrives for the second round only.
    await call("ben", "/live/p/begin-signed", { token });
    await edge.application.whenIdle();

    expect(await call("host", "/live/lectures/mark", { run })).toEqual({ run, lecture: true });
    const { lectures } = await presentAt("grader");
    expect(lectures.flatMap((lecture) => lecture.present)).toEqual([users.ben]);

    // A round is not a run that can be marked.
    const parts = await edge.application.concepts.Publishing._partsOf({ whole: run as string });
    expect(await call("host", "/live/lectures/mark", { run: parts.parts[0] })).toEqual({
      error: "NOT_FOUND",
    });
  });

  test("past runs list every run with whether it is a lecture", async () => {
    const read = (await call("grader", "/live/lectures/runs")) as {
      questionnaires: { title: string; kind: string; runs: { run: string; lecture: boolean }[] }[];
      relays: { title: string; runs: { run: string; lecture: boolean }[] }[];
    };
    expect(read.questionnaires.map((entry) => entry.title).sort()).toEqual([
      "Exit ticket",
      "Warm-up",
    ]);
    expect(read.questionnaires.every((entry) => entry.kind === "survey")).toBe(true);
    expect(read.questionnaires.flatMap((entry) => entry.runs).some((run) => run.lecture)).toBe(
      false,
    );
    expect(read.relays.flatMap((entry) => entry.runs).map((run) => run.lecture)).toEqual([true]);
  });

  test("marking needs live:host or course:manage; reading needs a staff capability", async () => {
    const { run } = await quizRun("Pop quiz");
    expect(await call("grader", "/live/lectures/mark", { run })).toEqual({ error: "FORBIDDEN" });
    expect(await call("grader", "/live/lectures/unmark", { run })).toEqual({ error: "FORBIDDEN" });
    expect(await call("ana", "/live/lectures/attendance")).toEqual({ error: "FORBIDDEN" });
    expect(await call("ana", "/live/lectures/runs")).toEqual({ error: "FORBIDDEN" });
    await call("host", "/live/runs/close", { run });
  });
});

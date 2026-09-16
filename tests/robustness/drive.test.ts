import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  Client,
  inviteStudents,
  Log,
  SignedPhone,
  waitUntilPlaced,
  wallSettled,
  type Wall,
} from "./drive.ts";

interface Sent {
  path: string;
  cookie: string | null;
  body: Record<string, unknown>;
}

function record(
  into: Sent[],
  reply: (sent: Sent) => Response | Promise<Response>,
): (url: string, init: RequestInit) => Promise<Response> {
  return async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const sent: Sent = {
      path: new URL(url).pathname,
      cookie: headers.Cookie ?? null,
      body: JSON.parse(typeof init.body === "string" ? init.body : "{}") as Record<string, unknown>,
    };
    into.push(sent);
    return await reply(sent);
  };
}

const directories: string[] = [];
const initialExitCode = process.exitCode;
afterEach(() => {
  process.exitCode = initialExitCode;
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

test("placed cards do not imply completed sorting", () => {
  const wall = {
    cards: [{ pile: "one" }],
    asksOut: 0,
    sortPending: false,
  } as Wall;
  expect(wallSettled(wall)).toBe(true);
  expect(wallSettled({ ...wall, asksOut: 1 })).toBe(false);
  expect(wallSettled({ ...wall, sortPending: true })).toBe(false);
  expect(wallSettled(wall, 2)).toBe(false);
  expect(wallSettled({ ...wall, cards: [] })).toBe(false);
});

test("a timed-out placement wait fails without requesting another sort", async () => {
  const paths: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    paths.push(new URL(url).pathname);
    return Response.json({ wall: null });
  });
  await expect(waitUntilPlaced(new Client("http://localhost"), "round", 1, 0)).rejects.toThrow(
    "did not finish sorting",
  );
  expect(paths).toEqual(["/live/walls/read"]);
});

test.each(["broken", "slow"] as const)("%s findings have an explicit verdict", (kind) => {
  const directory = mkdtempSync(join(tmpdir(), "commons-findings-"));
  directories.push(directory);
  const log = new Log("test", directory);
  log.finding({ kind, title: "Example", steps: "Example" });
  log.write();
  const report = JSON.parse(readFileSync(join(directory, "findings.json"), "utf8"));
  expect(report.verdict).toBe(kind === "broken" ? "failed" : "review");
  expect(process.exitCode).toBe(kind === "broken" ? 1 : initialExitCode);
});

test("a signed phone hands in over the signed endpoints, carrying its cookie", async () => {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    record(sent, () =>
      Response.json(
        { response: "response-1", wall: null },
        { headers: { "set-cookie": "commons=abc; Path=/; HttpOnly" } },
      ),
    ),
  );
  const phone = new SignedPhone("token-1", { username: "load-0", password: "password123" });
  await phone.signIn();
  await phone.handIn({ question: "question-1", parts: [], cap: 0 }, () => "three plain words");
  await phone.wall();
  expect(sent.map((one) => one.path)).toEqual([
    "/api/auth/login",
    "/api/live/p/begin-signed",
    "/api/live/p/answer-signed",
    "/api/live/p/submit-signed",
    "/api/live/p/wall-signed",
  ]);
  expect(sent[0]?.cookie).toBe(null);
  expect(sent.slice(1).map((one) => one.cookie)).toEqual(Array(4).fill("commons=abc"));
  expect(sent[1]?.body).toEqual({ token: "token-1" });
  expect(sent[2]?.body).toEqual({
    response: "response-1",
    question: "question-1",
    value: "three plain words",
  });
  expect(sent[4]?.body).toEqual({ response: "response-1" });
});

test("inviting students reuses an account the edge already knows", async () => {
  const sent: Sent[] = [];
  vi.stubGlobal(
    "fetch",
    record(sent, (one) => {
      if (one.path.endsWith("/auth/resolve"))
        return Response.json({ user: one.body.username === "load-0" ? "user-0" : null });
      if (one.path.endsWith("/invitations/invite"))
        return Response.json({ invitation: "invitation-1" });
      return Response.json({ user: "user-1" });
    }),
  );
  const students = await inviteStudents(new Client(), 2, "load");
  expect(students).toEqual([
    { username: "load-0", password: "password123", user: "user-0" },
    { username: "load-1", password: "password123", user: "user-1" },
  ]);
  expect(sent.map((one) => one.path)).toEqual([
    "/api/auth/resolve",
    "/api/auth/resolve",
    "/api/invitations/invite",
    "/api/auth/accept-invitation",
  ]);
  expect(sent[3]?.body.temporaryPassword).toMatch(/^C-/);
});

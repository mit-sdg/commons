import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vite-plus/test";
import { MongoClient } from "mongodb";
import { testMongoServer } from "../support/mongo-server.ts";

const checkout = join(import.meta.dirname, "../..");
let root: string;
let mongo: Awaited<ReturnType<typeof testMongoServer>>["server"];
let stopMongo: (() => Promise<void>) | undefined;

beforeAll(async () => {
  // A different port does not isolate Next's on-disk cache or dev-server
  // lock. Exercise the real scripts in a disposable checkout, without .env.
  root = mkdtempSync(join(tmpdir(), "commons-deployment-"));
  for (const entry of ["src", "scripts", "design", "generated", "package.json", "tsconfig.json"])
    cpSync(join(checkout, entry), join(root, entry), { recursive: true });
  cpSync(join(checkout, "frontend"), join(root, "frontend"), {
    recursive: true,
    filter: (path) =>
      !["node_modules", ".next"].includes(basename(path)) && !basename(path).startsWith(".env"),
  });
  for (const entry of ["node_modules", "frontend/node_modules"])
    symlinkSync(join(checkout, entry), join(root, entry), "dir");
  const service = await testMongoServer();
  mongo = service.server;
  stopMongo = service.stop;
});

afterAll(async () => {
  await stopMongo?.();
  if (root !== undefined) rmSync(root, { recursive: true, force: true });
});
interface RunningChild {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<number>;
}

const liveChildren = new Set<RunningChild>();

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() => reject(new Error("could not allocate a local port")));
        return;
      }
      server.close((error) => (error === undefined ? resolve(address.port) : reject(error)));
    });
  });
}

async function collect(stream: NodeJS.ReadableStream, output: string[]) {
  for await (const chunk of stream) output.push(String(chunk));
}

async function until(
  check: () => boolean | Promise<boolean>,
  failure: () => string,
  timeout = 30_000,
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await pause(100);
  }
  throw new Error(failure());
}

function startChild(
  command: string[],
  options: { cwd: string; env: Record<string, string | undefined> },
) {
  const output: string[] = [];
  const child = spawn(command[0], command.slice(1), {
    ...options,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.end();
  const drains = [collect(child.stdout, output), collect(child.stderr, output)];
  let exitCode: number | undefined;
  let running!: RunningChild;
  const exited = new Promise<number>((resolve) => {
    child.once("error", (error) => {
      output.push(String(error));
    });
    child.once("exit", (code, signal) => {
      exitCode = code ?? (signal === null ? 1 : 128);
      liveChildren.delete(running);
      resolve(exitCode);
    });
  });
  running = { child, exited };
  liveChildren.add(running);
  return { child, drains, exited, output, exitCode: () => exitCode };
}

async function stopChild(running: ReturnType<typeof startChild>) {
  if (running.exitCode() === undefined) running.child.kill("SIGTERM");
  const result = await Promise.race([
    running.exited.then((code) => ({ code })),
    pause(8_000).then(() => ({ code: undefined })),
  ]);
  if (result.code === undefined) {
    running.child.kill("SIGKILL");
    await running.exited;
  }
  await Promise.allSettled(running.drains);
  return result.code;
}

async function startEdge(
  mongodbUrl: string | undefined,
  port: number,
  mongodbVariable: "MONGODB_URI" | "MONGODB_URL" = "MONGODB_URL",
) {
  const origin = `http://127.0.0.1:${port}`;
  const env: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    LOG_LEVEL: "error",
    INVITATION_SECRET: "deployment-invitation-secret",
    COMMONS_TEST_BOOTSTRAP: JSON.stringify({
      username: "operator",
      password: "password123",
      displayName: "Local Operator",
      email: "operator@example.com",
    }),
  };
  delete env.MONGODB_URI;
  delete env.MONGODB_URL;
  if (mongodbUrl !== undefined) env[mongodbVariable] = mongodbUrl;
  const running = startChild(["bun", "src/start.ts"], {
    cwd: root,
    env,
  });
  await until(
    async () => {
      if (running.exitCode() !== undefined) return false;
      try {
        const response = await fetch(`${origin}/api/threads/activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return response.status === 401;
      } catch {
        return false;
      }
    },
    () => `edge did not become ready:\n${running.output.join("")}`,
  );
  await until(
    () => running.output.join("").includes("commons: serving"),
    () => `edge emitted no readiness line:\n${running.output.join("")}`,
  );
  return { ...running, origin };
}

async function post(origin: string, path: string, body: unknown, cookie?: string) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie === undefined ? {} : { Cookie: cookie }),
    },
    body: JSON.stringify(body),
  });
  return { response, body: (await response.json()) as Record<string, unknown> };
}

const sessionCookie = (response: Response) => response.headers.get("set-cookie")?.split(";", 1)[0];

afterEach(async () => {
  for (const running of liveChildren) running.child.kill("SIGKILL");
  await Promise.allSettled([...liveChildren].map((running) => running.exited));
  liveChildren.clear();
});

describe("the Commons process with MongoDB", () => {
  test("uses MONGODB_URI, retains a thread and session across restart, and leaves the supplied service running", async () => {
    let edge: Awaited<ReturnType<typeof startEdge>> | undefined;
    try {
      const database = `deployment-${crypto.randomUUID()}`;
      const mongodbUrl = mongo.getUri(database);
      edge = await startEdge(mongodbUrl, await freePort(), "MONGODB_URI");
      expect(edge.output.join("")).toContain(
        `commons: storing concept state in MongoDB database ${database}.`,
      );

      const closedRegistration = await post(edge.origin, "/api/auth/register", {
        username: "anyone",
        password: "password123",
        displayName: "Anyone",
        email: "anyone@example.com",
      });
      expect(closedRegistration.response.status).toBe(404);
      const operatorLogin = await post(edge.origin, "/api/auth/login", {
        username: "operator",
        password: "password123",
      });
      const operatorCookie = sessionCookie(operatorLogin.response);
      expect(operatorCookie).toMatch(/^__Host-commons-session=/);

      const learnerInvitation = await post(
        edge.origin,
        "/api/invitations/invite",
        { email: "learner@example.com" },
        operatorCookie,
      );
      expect(learnerInvitation.response.status).toBe(200);
      const databaseClient = new MongoClient(mongodbUrl);
      await databaseClient.connect();
      const invitationDoc = await databaseClient
        .db()
        .collection<{ _id: string }>("inviting.invitations")
        .findOne({ channel: "email", address: "learner@example.com" });
      await databaseClient.close();
      expect(invitationDoc).not.toBeNull();
      const { createHmac } = await import("node:crypto");
      const invitation = invitationDoc?._id ?? "";
      const temporaryPassword = `C-${createHmac("sha256", "deployment-invitation-secret")
        .update(`commons-invitation-v1\0${invitation}`)
        .digest("base64url")
        .slice(0, 24)}`;
      const learnerRegistration = await post(edge.origin, "/api/auth/accept-invitation", {
        invitation,
        temporaryPassword,
        username: "learner",
        password: "password123",
        displayName: "Local Learner",
      });
      expect(learnerRegistration.response.status).toBe(200);
      const learnerLogin = await post(edge.origin, "/api/auth/login", {
        username: "learner",
        password: "password123",
      });
      const learnerCookie = sessionCookie(learnerLogin.response);
      expect(learnerCookie).toMatch(/^__Host-commons-session=/);

      const operatorMe = await post(edge.origin, "/api/auth/me", {}, operatorCookie);
      expect(operatorMe.body.username).toBe("operator");

      await post(
        edge.origin,
        "/api/roster/import",
        { rows: [{ email: "learner@example.com", kind: "STUDENT" }] },
        operatorCookie,
      );
      const threadResult = await post(
        edge.origin,
        "/api/threads/create",
        { holders: ["standing:everyone"], content: "# Reading notes\nA question for @operator" },
        learnerCookie,
      );
      expect(threadResult.response.status).toBe(200);
      const conversation = String(threadResult.body.conversation);
      const rootNode = String(threadResult.body.node);

      const reply = await post(
        edge.origin,
        "/api/threads/reply",
        { parent: rootNode, content: "A persistent reply" },
        learnerCookie,
      );
      expect(reply.response.status).toBe(200);
      expect(await stopChild(edge)).toBe(0);
      expect(edge.output.join("")).toContain("commons: edge stopped");
      const observer = new MongoClient(mongodbUrl);
      try {
        expect(await observer.db().command({ ping: 1 })).toMatchObject({ ok: 1 });
        const operator = await observer
          .db()
          .collection("authenticating.users")
          .findOne({ username: "operator" });
        expect(operator?.passwordVerifier).toMatch(/^\$scrypt\$N=16384,r=8,p=1\$/);
      } finally {
        await observer.close();
      }
      edge = await startEdge(mongodbUrl, await freePort());
      const retainedSession = await post(edge.origin, "/api/auth/me", {}, learnerCookie);
      expect(retainedSession.body.username).toBe("learner");
      const retainedThread = await post(
        edge.origin,
        "/api/threads/get",
        { conversation },
        learnerCookie,
      );
      expect(retainedThread.body.thread as unknown[]).toHaveLength(2);
      expect((retainedThread.body.thread as { rendered: string }[])[0].rendered).toContain("<h1>");
    } finally {
      if (edge !== undefined) await stopChild(edge);
    }
  }, 120_000);

  test("stops the temporary-Mongo wrapper promptly during bootstrap", async () => {
    const running = startChild(["bun", "scripts/stack-mongo.ts"], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(await freePort()),
        WEB_PORT: String(await freePort()),
      },
    });
    await until(
      () => running.output.join("").includes("starting temporary local MongoDB"),
      () => `temporary-Mongo wrapper did not start:\n${running.output.join("")}`,
    );
    const signaledAt = Date.now();
    running.child.kill("SIGTERM");
    expect(await running.exited).toBe(0);
    expect(Date.now() - signaledAt).toBeLessThan(5_000);
    await Promise.allSettled(running.drains);
  }, 10_000);

  test("runs and stops the temporary-Mongo stack command", async () => {
    const port = await freePort();
    const webPort = await freePort();
    const origin = `http://127.0.0.1:${webPort}`;
    const running = startChild(["bun", "scripts/stack-mongo.ts"], {
      cwd: root,
      env: { ...process.env, PORT: String(port), WEB_PORT: String(webPort) },
    });
    try {
      await until(
        async () => {
          if (running.exitCode() !== undefined) return false;
          try {
            const response = await fetch(`${origin}/api/auth/me`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            return response.status === 401;
          } catch {
            return false;
          }
        },
        () => `temporary stack did not become ready:\n${running.output.join("")}`,
        60_000,
      );
      expect(running.output.join("")).toContain("commons: temporary MongoDB");
      expect(running.output.join("")).toContain(
        "commons: storing concept state in MongoDB database",
      );
      const fromFrontendOrigin = await fetch(`http://127.0.0.1:${port}/api/threads/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: "{}",
      });
      expect(fromFrontendOrigin.status).toBe(401);
      const publicReadFromAnotherOrigin = await fetch(
        `http://127.0.0.1:${port}/api/threads/activity`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:3000",
          },
          body: "{}",
        },
      );
      expect(publicReadFromAnotherOrigin.status).toBe(401);
      expect(await stopChild(running)).toBe(0);
      expect(running.output.join("")).toContain("commons: temporary MongoDB stopped");
    } finally {
      if (running.exitCode() === undefined) await stopChild(running);
    }
  }, 90_000);
});

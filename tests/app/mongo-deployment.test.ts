import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { constructConceptFloor } from "../../src/assembly/concept-floor.ts";

const root = `${import.meta.dirname}/../..`;
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

async function startEdge(mongodbUrl: string | undefined, port: number) {
  const origin = `http://127.0.0.1:${port}`;
  const env: Record<string, string | undefined> = {
    ...process.env,
    PORT: String(port),
    LOG_LEVEL: "error",
  };
  if (mongodbUrl === undefined) delete env.MONGODB_URL;
  else env.MONGODB_URL = mongodbUrl;
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
        return response.status === 200;
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

async function startFrontend(edgeOrigin: string, port: number) {
  const origin = `http://127.0.0.1:${port}`;
  const running = startChild(
    ["bun", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: `${root}/frontend`,
      env: {
        ...process.env,
        BACKEND_ORIGIN: edgeOrigin,
        NODE_ENV: "development",
        PATH: `${root}/frontend/node_modules/.bin:${process.env.PATH}`,
        WATCHPACK_POLLING: "true",
      },
    },
  );
  await until(
    async () => {
      if (running.exitCode() !== undefined) return false;
      try {
        return (await fetch(`${origin}/login`)).status === 200;
      } catch {
        return false;
      }
    },
    () => `frontend did not become ready:\n${running.output.join("")}`,
    60_000,
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
  test("uses memory when MONGODB_URL is omitted", async () => {
    const running = await startEdge(undefined, await freePort());
    expect(running.output.join("")).toContain("commons: storing concept state in memory.");
    expect(await stopChild(running)).toBe(0);
    expect(running.output.join("")).toContain("commons: edge stopped");
  });

  test("reads the database name from mongodb:// and mongodb+srv:// URL paths", async () => {
    const memory = await constructConceptFloor();
    expect(memory.name).toBe("memory");
    await memory.close();

    for (const [url, database] of [
      ["mongodb://127.0.0.1:27017/commons", "commons"],
      [
        "mongodb+srv://operator:credential@cluster.example.test/hosted-commons?retryWrites=true&w=majority",
        "hosted-commons",
      ],
    ]) {
      let supplied = "";
      const floor = await constructConceptFloor(url, async (candidate) => {
        supplied = candidate;
        return new MongoClient(candidate);
      });
      expect(supplied).toBe(url);
      expect(floor.name).toBe("mongo");
      expect(floor.resources).toEqual([`MongoDB database ${database}`]);
      await floor.close();
    }
  });

  test("requires a valid MongoDB URL with database selection without exposing credentials", async () => {
    for (const [url, message] of [
      [
        "mongodb://operator:missing-database-secret@127.0.0.1:27017",
        "commons: MONGODB_URL must select a database in its path.",
      ],
      [
        "https://operator:invalid-url-secret@127.0.0.1:27017/commons",
        "commons: MONGODB_URL is not a valid MongoDB connection URL.",
      ],
    ]) {
      const running = startChild(["bun", "src/start.ts"], {
        cwd: root,
        env: { ...process.env, MONGODB_URL: url, PORT: String(await freePort()) },
      });
      expect(await running.exited).not.toBe(0);
      await Promise.allSettled(running.drains);
      expect(running.output.join("")).toContain(message);
      expect(running.output.join("")).not.toContain("secret");
    }
  }, 20_000);

  test("when Commons stops, it closes its client and leaves the supplied MongoDB service and database running", async () => {
    const mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
    const mongodbUrl = mongo.getUri(`lifecycle-${crypto.randomUUID()}`);
    let running: Awaited<ReturnType<typeof startEdge>> | undefined;
    try {
      running = await startEdge(mongodbUrl, await freePort());
      expect(await stopChild(running)).toBe(0);
      expect(running.output.join("")).toContain("commons: edge stopped");
      const observer = new MongoClient(mongodbUrl);
      await observer.connect();
      expect(await observer.db().command({ ping: 1 })).toMatchObject({ ok: 1 });
      await observer.close();
    } finally {
      if (running !== undefined && running.exitCode() === undefined) await stopChild(running);
      await mongo.stop();
    }
  }, 30_000);

  test("serves the application over HTTP, retains concept state across edge restart, and reaches it through the frontend proxy", async () => {
    const mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
    let edge: Awaited<ReturnType<typeof startEdge>> | undefined;
    let frontend: Awaited<ReturnType<typeof startFrontend>> | undefined;
    try {
      const database = `deployment-${crypto.randomUUID()}`;
      const mongodbUrl = mongo.getUri(database);
      edge = await startEdge(mongodbUrl, await freePort());
      expect(edge.output.join("")).toContain(
        `commons: storing concept state in MongoDB database ${database}.`,
      );

      const operatorRegistration = await post(edge.origin, "/api/auth/register", {
        username: "operator",
        password: "password123",
        displayName: "Local Operator",
        email: "operator@example.com",
      });
      expect(operatorRegistration.response.status).toBe(200);
      const operatorLogin = await post(edge.origin, "/api/auth/login", {
        username: "operator",
        password: "password123",
      });
      const operatorCookie = sessionCookie(operatorLogin.response);
      expect(operatorCookie).toMatch(/^__Host-commons-session=/);

      const learnerRegistration = await post(edge.origin, "/api/auth/register", {
        username: "learner",
        password: "password123",
        displayName: "Local Learner",
        email: "learner@example.com",
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
      const operator = String(operatorMe.body.user);

      const threadResult = await post(
        edge.origin,
        "/api/threads/create",
        { content: "# Reading notes\nA question for @operator" },
        learnerCookie,
      );
      expect(threadResult.response.status).toBe(200);
      const conversation = String(threadResult.body.conversation);
      const rootPost = String(threadResult.body.post);
      const rootNode = String(threadResult.body.node);

      const subscribed = await post(
        edge.origin,
        "/api/subscriptions/subscribe",
        { target: conversation },
        operatorCookie,
      );
      expect(subscribed.response.status).toBe(200);

      const replyResult = await post(
        edge.origin,
        "/api/threads/reply",
        { parent: rootNode, content: `The source points to [[${rootPost}]]` },
        learnerCookie,
      );
      expect(replyResult.response.status).toBe(200);
      const replyPost = String(replyResult.body.post);

      const formedThread = await post(edge.origin, "/api/threads/get", { conversation });
      expect(formedThread.response.status).toBe(200);
      const thread = formedThread.body.thread as { rendered: string }[];
      expect(thread).toHaveLength(2);
      expect(thread[0].rendered).toContain("<h1>");

      const links = await post(edge.origin, "/api/links/forward", { source: replyPost });
      expect(links.body.targets).toEqual([{ target: rootPost }]);
      const unread = await post(
        edge.origin,
        "/api/unread/list",
        { scope: conversation },
        operatorCookie,
      );
      expect((unread.body.items as unknown[]).length).toBeGreaterThan(0);
      const notifications = await post(edge.origin, "/api/notifications/list", {}, operatorCookie);
      expect(
        (notifications.body.notifications as { kind: string }[]).some(
          ({ kind }) => kind === "mention" || kind === "reply",
        ),
      ).toBe(true);

      const locked = await post(
        edge.origin,
        "/api/locks/lock",
        { target: conversation },
        operatorCookie,
      );
      expect(locked.response.status).toBe(200);
      const refused = await post(
        edge.origin,
        "/api/threads/reply",
        { parent: rootNode, content: "This must be refused" },
        learnerCookie,
      );
      expect(refused.response.status).toBe(403);
      expect(refused.body).toEqual({ error: "FORBIDDEN" });

      const roleResult = await post(
        edge.origin,
        "/api/roles/define",
        { name: "course-operator", capabilities: ["roster:manage", "assignments:manage"] },
        operatorCookie,
      );
      const role = String(roleResult.body.role);
      expect(roleResult.response.status).toBe(200);
      const granted = await post(
        edge.origin,
        "/api/roles/grant",
        { role, user: operator, context: "forum" },
        operatorCookie,
      );
      expect(granted.response.status).toBe(200);

      const configured = await post(
        edge.origin,
        "/api/roster/configure-class",
        { code: "LOCAL101", title: "Local Commons", term: "Now", timezone: "UTC" },
        operatorCookie,
      );
      expect(configured.response.status).toBe(200);
      const sectionResult = await post(
        edge.origin,
        "/api/roster/sections/create",
        { name: "Local", location: "Here", meetingPattern: "Any time" },
        operatorCookie,
      );
      expect(sectionResult.response.status).toBe(200);
      const section = String(sectionResult.body.section);
      const imported = await post(
        edge.origin,
        "/api/roster/import",
        {
          rows: [
            {
              externalKey: "learner-1",
              email: "learner@example.com",
              rosterName: "Local Learner",
              kind: "STUDENT",
              section,
            },
          ],
        },
        operatorCookie,
      );
      expect(imported.response.status).toBe(200);
      const claimed = await post(
        edge.origin,
        "/api/roster/claim-seat",
        { externalKey: "learner-1" },
        learnerCookie,
      );
      expect(claimed.response.status).toBe(200);

      const now = Date.now();
      const assignmentResult = await post(
        edge.origin,
        "/api/assignments/create-draft",
        {
          title: "Local reading",
          instructions: "Read and respond",
          kind: "HOMEWORK",
          availableAt: new Date(now - 3_600_000).toISOString(),
          dueAt: new Date(now + 86_400_000).toISOString(),
          audience: "EVERYONE",
          acceptsSubmissions: true,
        },
        operatorCookie,
      );
      expect(assignmentResult.response.status).toBe(200);
      const assignment = String(assignmentResult.body.assignment);
      const published = await post(
        edge.origin,
        "/api/assignments/publish",
        { assignment },
        operatorCookie,
      );
      expect(published.response.status).toBe(200);
      const submitted = await post(
        edge.origin,
        "/api/assignments/submit",
        { assignment, content: "A local answer" },
        learnerCookie,
      );
      expect(submitted.response.status).toBe(200);
      const beforeRestart = await post(edge.origin, "/api/assignments/for-me", {}, learnerCookie);
      expect(
        (beforeRestart.body.assignments as { assignment: string }[]).some(
          (row) => row.assignment === assignment,
        ),
      ).toBe(true);

      const unknown = await post(edge.origin, "/api/not-a-route", {});
      expect(unknown.response.status).toBe(404);
      expect(unknown.body.error).toBe("NOT_FOUND");
      const malformed = await fetch(`${edge.origin}/api/auth/login`, {
        method: "POST",
        body: "{not json",
      });
      expect(malformed.status).toBe(400);
      expect(await malformed.json()).toEqual({ error: "INVALID_REQUEST" });
      const invalid = await post(edge.origin, "/api/auth/login", 7);
      expect(invalid.response.status).toBe(400);
      expect(invalid.body).toEqual({ error: "INVALID_REQUEST" });

      expect(await stopChild(edge)).toBe(0);
      expect(edge.output.join("")).toContain("commons: edge stopped");
      edge = await startEdge(mongodbUrl, await freePort());

      const retainedSession = await post(edge.origin, "/api/auth/me", {}, learnerCookie);
      expect(retainedSession.body.username).toBe("learner");
      const retainedThread = await post(edge.origin, "/api/threads/get", { conversation });
      expect(retainedThread.body.thread as unknown[]).toHaveLength(2);
      const retainedCourse = await post(edge.origin, "/api/assignments/for-me", {}, learnerCookie);
      expect(
        (retainedCourse.body.assignments as { assignment: string }[]).some(
          (row) => row.assignment === assignment,
        ),
      ).toBe(true);
      const composedDashboard = await post(edge.origin, "/api/lms/me", {}, learnerCookie);
      expect((composedDashboard.body.dashboard as unknown[]).length).toBeGreaterThan(0);
      const retainedLinks = await post(edge.origin, "/api/links/forward", { source: replyPost });
      expect(retainedLinks.body.targets).toEqual([{ target: rootPost }]);

      frontend = await startFrontend(edge.origin, await freePort());
      const loginPage = await fetch(`${frontend.origin}/login`);
      expect(loginPage.status).toBe(200);
      expect(await loginPage.text()).toContain("Sign in");
      const homePage = await fetch(frontend.origin);
      expect(homePage.status).toBe(200);
      expect(await homePage.text()).toContain("Welcome to Commons");
      const assignmentsPage = await fetch(`${frontend.origin}/assignments`, {
        headers: { Cookie: learnerCookie ?? "" },
      });
      expect(assignmentsPage.status).toBe(200);
      expect(await assignmentsPage.text()).toContain("Assignments");
      const throughProxy = await post(frontend.origin, "/api/auth/me", {}, learnerCookie);
      expect(throughProxy.response.status).toBe(200);
      expect(throughProxy.body.username).toBe("learner");
    } finally {
      if (frontend !== undefined) await stopChild(frontend);
      if (edge !== undefined) await stopChild(edge);
      await mongo.stop();
    }
  }, 120_000);

  test("reports an occupied edge port as a startup failure", async () => {
    const holder = createServer();
    await new Promise<void>((resolve, reject) => {
      holder.once("error", reject);
      holder.listen(0, "127.0.0.1", resolve);
    });
    try {
      const address = holder.address();
      if (address === null || typeof address === "string") throw new Error("missing port");
      const running = startChild(["bun", "src/start.ts"], {
        cwd: root,
        env: { ...process.env, PORT: String(address.port) },
      });
      expect(await running.exited).not.toBe(0);
      await Promise.allSettled(running.drains);
      expect(running.output.join("")).toContain("commons: could not listen");
    } finally {
      await new Promise<void>((resolve) => holder.close(() => resolve()));
    }
  }, 20_000);

  test("rejects an invalid port before opening its Mongo client", async () => {
    const mongo = await MongoMemoryServer.create({ instance: { ip: "127.0.0.1" } });
    try {
      const running = startChild(["bun", "src/start.ts"], {
        cwd: root,
        env: { ...process.env, MONGODB_URL: mongo.getUri(), PORT: "0" },
      });
      expect(await running.exited).not.toBe(0);
      await Promise.allSettled(running.drains);
      expect(running.output.join("")).toContain(
        'commons: PORT must be an integer from 1 to 65535; received "0"',
      );
    } finally {
      await mongo.stop();
    }
  }, 20_000);

  test("stops the stack promptly when signaled during edge readiness", async () => {
    const port = await freePort();
    const webPort = await freePort();
    const running = startChild(["bun", "scripts/stack.ts"], {
      cwd: root,
      env: {
        ...process.env,
        MONGODB_URL: "mongodb://127.0.0.1:1/commons?serverSelectionTimeoutMS=30000",
        PORT: String(port),
        WEB_PORT: String(webPort),
      },
    });
    await pause(250);
    const signaledAt = Date.now();
    running.child.kill("SIGTERM");
    expect(await running.exited).toBe(0);
    expect(Date.now() - signaledAt).toBeLessThan(5_000);
    await Promise.allSettled(running.drains);
    expect(running.output.join("")).not.toContain("readiness timed out");
  }, 10_000);

  test("reports an unavailable external MongoDB before its readiness deadline", async () => {
    const running = startChild(["bun", "scripts/stack.ts"], {
      cwd: root,
      env: {
        ...process.env,
        MONGODB_URL: "mongodb://operator:connection-secret@127.0.0.1:1/commons",
        PORT: String(await freePort()),
        WEB_PORT: String(await freePort()),
      },
    });
    expect(await running.exited).not.toBe(0);
    await Promise.allSettled(running.drains);
    const output = running.output.join("");
    expect(output).toContain("commons: could not connect to the configured MongoDB.");
    expect(output).not.toContain("connection-secret");
    expect(output).not.toContain("readiness timed out");
  }, 15_000);

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
            return (await fetch(`${origin}/login`)).status === 200;
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
      expect(fromFrontendOrigin.status).toBe(200);
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
      expect(publicReadFromAnotherOrigin.status).toBe(200);
      expect(await stopChild(running)).toBe(0);
      expect(running.output.join("")).toContain("commons: temporary MongoDB stopped");
    } finally {
      if (running.exitCode() === undefined) await stopChild(running);
    }
  }, 90_000);
});

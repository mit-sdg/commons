import { stackBackendEnvironment } from "./stack-environment.ts";

const root = `${import.meta.dir}/..`;

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

function portFrom(name: "PORT" | "WEB_PORT", fallback: string): string {
  const source = process.env[name] ?? fallback;
  const port = Number(source);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: ${name} must be an integer from 1 to 65535; received "${source}"`);
  }
  return source;
}

async function relay(stream: ReadableStream<Uint8Array>, prefix: string) {
  const decoder = new TextDecoder();
  let rest = "";
  for await (const chunk of stream) {
    rest += decoder.decode(chunk, { stream: true });
    const lines = rest.split("\n");
    rest = lines.pop() ?? "";
    for (const line of lines) console.log(`${prefix} ${line}`);
  }
  if (rest) console.log(`${prefix} ${rest}`);
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForEdge(origin: string, exited: () => number | undefined) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const code = exited();
    if (code !== undefined) throw new Error(`commons: edge exited before readiness (code ${code})`);
    try {
      const response = await fetch(`${origin}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "readiness", password: "not-a-real-password" }),
      });
      if (response.status === 401) return;
    } catch {}
    await pause(100);
  }
  throw new Error(`commons: edge readiness timed out after 90 seconds (${origin})`);
}

function spawnPiped(
  command: string[],
  options: { cwd: string; env?: Record<string, string | undefined> },
) {
  return Bun.spawn(command, {
    ...options,
    stdout: "pipe",
    stderr: "pipe",
  });
}

const edgePort = portFrom("PORT", "4000");
const webPort = portFrom("WEB_PORT", "3000");
const edgeOrigin = `http://127.0.0.1:${edgePort}`;
const webOrigin = `http://127.0.0.1:${webPort}`;
const publicOrigin = process.env.PUBLIC_ORIGIN ?? webOrigin;
const webHost = process.env.WEB_HOST ?? (process.env.PUBLIC_ORIGIN ? "0.0.0.0" : "127.0.0.1");
const defaultBootstrap = JSON.stringify({
  username: "mara",
  password: "password123",
  displayName: "Mara Chen",
  email: "mara@example.edu",
});

const edge = spawnPiped(["bun", "src/start.ts"], {
  cwd: root,
  env: stackBackendEnvironment(
    {
      COMMONS_TEST_BOOTSTRAP: process.env.COMMONS_TEST_BOOTSTRAP ?? defaultBootstrap,
      ...process.env,
    },
    publicOrigin,
  ),
});
let edgeExitCode: number | undefined;
const edgeExited = edge.exited.then((code) => {
  edgeExitCode = code;
  return code;
});
const relays: Promise<void>[] = [relay(edge.stdout, "[edge]"), relay(edge.stderr, "[edge]")];

let web: ReturnType<typeof spawnPiped> | undefined;
let webExited: Promise<number> | undefined;

let signal: NodeJS.Signals | undefined;
let releaseSignal!: () => void;
const signaled = new Promise<void>((resolve) => {
  releaseSignal = resolve;
});
const onSignal = (received: NodeJS.Signals) => {
  signal = received;
  releaseSignal();
};
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

let exitCode = 0;
try {
  const ready = await Promise.race([
    waitForEdge(edgeOrigin, () => edgeExitCode).then(() => true),
    signaled.then(() => false),
  ]);
  if (ready) {
    console.log(`[stack] edge ready at ${edgeOrigin}`);
    if (process.env.MONGODB_URL) {
      const { seedDemoData } = await import("./seed.ts");
      await seedDemoData(process.env.MONGODB_URL, edgeOrigin);
    }

    const webEnv = { ...process.env };
    delete webEnv.PORT;
    web = spawnPiped(["bun", "run", "dev", "--", "--hostname", webHost, "--port", webPort], {
      cwd: `${root}/frontend`,
      env: {
        ...webEnv,
        BACKEND_ORIGIN: edgeOrigin,
        PATH: `${root}/frontend/node_modules/.bin:${process.env.PATH}`,
        WATCHPACK_POLLING: "true",
      },
    });
    webExited = web.exited;
    relays.push(relay(web.stdout, "[web]"), relay(web.stderr, "[web]"));
    console.log(`[stack] frontend starting at ${publicOrigin}`);

    const first = await Promise.race([
      signaled.then(() => ({ source: "signal" as const, code: 0 })),
      edgeExited.then((code) => ({ source: "edge" as const, code })),
      webExited.then((code) => ({ source: "frontend" as const, code })),
    ]);
    if (first.source !== "signal") {
      console.error(`[stack] ${first.source} exited unexpectedly (code ${first.code})`);
      exitCode = first.code === 0 ? 1 : first.code;
    }
  }
} catch (error) {
  console.error(`[stack] ${messageOf(error)}`);
  exitCode = 1;
} finally {
  edge.kill(signal ?? "SIGTERM");
  web?.kill(signal ?? "SIGTERM");
  await Promise.allSettled([edgeExited, ...(webExited === undefined ? [] : [webExited])]);
  await Promise.allSettled(relays);
}

process.exitCode = exitCode;

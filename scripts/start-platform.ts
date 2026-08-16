type ManagedProcess = ReturnType<typeof Bun.spawn>;

const backendPort = process.env.COMMONS_BACKEND_PORT ?? "4000";
const frontendPort = process.env.COMMONS_FRONTEND_PORT ?? "3000";
const backendOrigin = `http://127.0.0.1:${backendPort}`;

const spawn = (command: string[], environment: Record<string, string | undefined>) =>
  Bun.spawn({
    cmd: command,
    env: environment,
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });

const terminate = (child: ManagedProcess, signal: NodeJS.Signals = "SIGTERM") => {
  try {
    child.kill(signal);
  } catch {
    // The process may already have exited.
  }
};

const waitForExit = async (child: ManagedProcess, graceMs = 10_000) => {
  const completed = await Promise.race([
    child.exited.then(() => true),
    Bun.sleep(graceMs).then(() => false),
  ]);
  if (!completed) {
    terminate(child, "SIGKILL");
    await child.exited;
  }
};

let backend: ManagedProcess | undefined;
let frontend: ManagedProcess | undefined;
let stopping = false;

async function stopBoth(exitCode: number) {
  if (stopping) return;
  stopping = true;
  if (backend !== undefined) terminate(backend);
  if (frontend !== undefined) terminate(frontend);
  await Promise.all([
    ...(backend === undefined ? [] : [waitForExit(backend)]),
    ...(frontend === undefined ? [] : [waitForExit(frontend)]),
  ]);
  process.exit(exitCode);
}

try {
  backend = spawn([process.execPath, "src/start.ts"], {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: backendPort,
  });
  frontend = spawn([process.execPath, "frontend/server.js"], {
    ...process.env,
    HOSTNAME: "0.0.0.0",
    PORT: frontendPort,
    BACKEND_ORIGIN: backendOrigin,
  });
} catch (error) {
  if (backend !== undefined) {
    terminate(backend);
    await waitForExit(backend);
  }
  throw error;
}

process.once("SIGINT", () => void stopBoth(0));
process.once("SIGTERM", () => void stopBoth(0));

const firstExit = await Promise.race([
  backend.exited.then((code) => ({ name: "backend", code })),
  frontend.exited.then((code) => ({ name: "frontend", code })),
]);
if (!stopping) {
  console.error(`commons: ${firstExit.name} exited; stopping the platform container.`);
  await stopBoth(firstExit.code === 0 ? 1 : firstExit.code);
}

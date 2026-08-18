type ManagedProcess = ReturnType<typeof Bun.spawn>;
type ProcessEnvironment = Record<string, string | undefined>;

export function platformProcessEnvironments(environment: ProcessEnvironment): {
  backend: ProcessEnvironment;
  frontend: ProcessEnvironment;
} {
  const backendPort = "4000";
  const frontendPort = environment.PORT ?? "3000";
  const backendOrigin = `http://127.0.0.1:${backendPort}`;

  return {
    backend: {
      ...environment,
      HOST: "127.0.0.1",
      PORT: backendPort,
    },
    frontend: {
      ...environment,
      HOSTNAME: "0.0.0.0",
      PORT: frontendPort,
      BACKEND_ORIGIN: backendOrigin,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  };
}

const spawn = (command: string[], environment: ProcessEnvironment) =>
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

export async function startPlatform() {
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

  const childEnvironments = platformProcessEnvironments(process.env);

  try {
    backend = spawn([process.execPath, "src/start.ts"], childEnvironments.backend);
    frontend = spawn(
      [process.execPath, "frontend/.next/standalone/frontend/server.js"],
      childEnvironments.frontend,
    );
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
}

if (import.meta.main) await startPlatform();

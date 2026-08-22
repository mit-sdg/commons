const root = `${import.meta.dir}/..`;
const database = `commons-${crypto.randomUUID()}`;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const v8 = await import("node:v8");
v8.startupSnapshot.isBuildingSnapshot = () => false;
const { MongoClient } = await import("mongodb");
const { MongoMemoryServer } = await import("mongodb-memory-server");

let mongo: InstanceType<typeof MongoMemoryServer> | undefined;
let receivedSignal: NodeJS.Signals | undefined;
let releaseSignal!: () => void;
const signaled = new Promise<void>((resolve) => {
  releaseSignal = resolve;
});
const onSignal = (signal: NodeJS.Signals) => {
  receivedSignal = signal;
  releaseSignal();
  if (mongo?.instanceInfo === undefined) process.exit(0);
};
process.once("SIGINT", onSignal);
process.once("SIGTERM", onSignal);

if (process.env.MONGODB_URL) {
  const stack = Bun.spawn(["bun", "scripts/stack.ts"], {
    cwd: root,
    env: process.env,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const first = await Promise.race([
    stack.exited.then((code) => ({ source: "stack" as const, code })),
    signaled.then(() => ({ source: "signal" as const, code: 0 })),
  ]);
  if (first.source === "signal") {
    stack.kill(receivedSignal ?? "SIGTERM");
    await stack.exited;
    process.exit(0);
  } else {
    process.exit(first.code);
  }
}

console.log("commons: starting temporary local MongoDB (the first run may download mongod)");

let exitCode = 1;
try {
  if (receivedSignal !== undefined) {
    exitCode = 0;
  } else {
    try {
      mongo = new MongoMemoryServer({ instance: { ip: "127.0.0.1" } });
      await mongo.start();
    } catch (error) {
      throw new Error(`temporary MongoDB failed to start: ${messageOf(error)}`, { cause: error });
    }

    const uri = mongo.getUri(database);
    const client = new MongoClient(uri);
    let version = "unknown";
    try {
      await client.connect();
      const build = await client.db("admin").command({ buildInfo: 1 });
      version = String(build.version ?? "unknown");
    } finally {
      await client.close();
    }

    if (receivedSignal !== undefined) {
      exitCode = 0;
    } else {
      console.log(`commons: temporary MongoDB ${version} at ${uri} (database ${database})`);
      console.log("commons: its database is removed when this stack stops");

      const stack = Bun.spawn(["bun", "scripts/stack.ts"], {
        cwd: root,
        env: { ...process.env, MONGODB_URL: uri },
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      const first = await Promise.race([
        stack.exited.then((code) => ({ source: "stack" as const, code })),
        signaled.then(() => ({ source: "signal" as const, code: 0 })),
      ]);
      if (first.source === "signal") {
        stack.kill(receivedSignal ?? "SIGTERM");
        await stack.exited;
        exitCode = 0;
      } else {
        exitCode = first.code;
      }
    }
  }
} catch (error) {
  console.error(`commons: ${messageOf(error)}`);
} finally {
  if (mongo !== undefined) {
    await mongo.stop();
    console.log("commons: temporary MongoDB stopped");
  }
}

process.exitCode = exitCode;

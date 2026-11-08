/**
 * Start a Commons stack over a temporary MongoDB at an address you know, so
 * the course seed can write to the stack's database on a moved clock:
 *
 *   PORT=4190 WEB_PORT=3190 bun tests/e2e/support/course-stack.ts [--mongo-port 27190]
 *
 * MongoDB listens on --mongo-port (by default 27000 plus the last three digits
 * of PORT, so 27190 for 4190) with the database `commons-course`, and the
 * script prints `MONGODB_URL=...` once it is up. The stack is
 * `scripts/stack.ts`, as `bun run dev` starts it. Ctrl-C stops the stack, then
 * MongoDB, and the database goes with it.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const root = `${import.meta.dir}/../../..`;
const DATABASE = "commons-course";

const args = process.argv.slice(2);
const edgePort = Number(process.env.PORT ?? "4000");
let mongoPort = 27_000 + (edgePort % 1000);
for (let index = 0; index < args.length; index += 1) {
  const arg = args[index] as string;
  const [flag, inline] = arg.includes("=") ? arg.split("=", 2) : [arg, undefined];
  if (flag === "--mongo-port") mongoPort = Number(inline ?? args[(index += 1)]);
  else {
    console.error(
      `unknown argument "${arg}"\nusage: PORT=4190 WEB_PORT=3190 bun tests/e2e/support/course-stack.ts [--mongo-port 27190]`,
    );
    process.exit(2);
  }
}
if (!Number.isInteger(mongoPort) || mongoPort < 1 || mongoPort > 65_535) {
  console.error(`--mongo-port must be a port number; received "${mongoPort}"`);
  process.exit(2);
}

/** Every process below `pid`, children first. */
function descendants(pid: number): number[] {
  const children = Bun.spawnSync(["pgrep", "-P", String(pid)])
    .stdout.toString()
    .split("\n")
    .filter(Boolean)
    .map(Number);
  return children.flatMap((child) => [child, ...descendants(child)]);
}

let signal: NodeJS.Signals | undefined;
let releaseSignal!: () => void;
const signaled = new Promise<void>((resolve) => {
  releaseSignal = resolve;
});
for (const name of ["SIGINT", "SIGTERM"] as const)
  process.once(name, () => {
    signal = name;
    releaseSignal();
  });

const mongo = new MongoMemoryServer({ instance: { ip: "127.0.0.1", port: mongoPort } });
await mongo.start();
const url = mongo.getUri(DATABASE);
console.log(`MONGODB_URL=${url}`);

let exitCode = 0;
try {
  if (signal === undefined) {
    const stack = Bun.spawn(["bun", "scripts/stack.ts"], {
      cwd: root,
      env: { ...process.env, MONGODB_URL: url },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    const first = await Promise.race([
      stack.exited.then((code) => ({ source: "stack" as const, code })),
      signaled.then(() => ({ source: "signal" as const, code: 0 })),
    ]);
    if (first.source === "signal") {
      // `bun run dev` does not pass a signal on to `next dev`, and a stack
      // started in the background ignores SIGINT, so stop the whole tree.
      const tree = descendants(stack.pid);
      stack.kill("SIGTERM");
      for (const pid of tree) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
      await stack.exited;
    } else exitCode = first.code;
  }
} finally {
  await mongo.stop();
  console.log("course-stack: temporary MongoDB stopped");
}
process.exitCode = exitCode;

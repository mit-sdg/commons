import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { bindTransport } from "@mit-sdg/sync-engine/boundary";

type Facts = Pick<ReturnType<typeof bindTransport>, "routes" | "logicalWire">;
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** One immutable native projection per surface per run, shared by thread workers. */
export function sharedProjection(surface: string, produce: () => Facts): Facts {
  const root = process.env.COMMONS_TEST_PROJECTIONS;
  if (root === undefined) return produce();
  const file = join(root, `${surface}.json`);
  const lock = `${file}.pending`;
  const read = () => freeze(JSON.parse(readFileSync(file, "utf8")) as Facts);
  if (existsSync(file)) return read();
  let owner = false;
  try {
    closeSync(openSync(lock, "wx"));
    owner = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!owner) {
    const deadline = process.hrtime.bigint() + 2_000_000_000n;
    const wait = new Int32Array(new SharedArrayBuffer(4));
    while (!existsSync(file) && process.hrtime.bigint() < deadline) Atomics.wait(wait, 0, 0, 10);
    // A failed producer must never prevent a file from running independently.
    return existsSync(file) ? read() : produce();
  }
  try {
    const facts = produce();
    const temporary = `${file}.${crypto.randomUUID()}`;
    writeFileSync(temporary, JSON.stringify(facts));
    renameSync(temporary, file);
    return facts;
  } finally {
    unlinkSync(lock);
  }
}

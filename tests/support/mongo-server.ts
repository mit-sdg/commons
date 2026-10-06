import { accessSync, constants, mkdtempSync, rmSync, statfsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

function storageRoot() {
  // Index creation fsyncs many tiny files. Use RAM-backed temporary storage
  // when available, but leave small container /dev/shm mounts alone.
  try {
    accessSync("/dev/shm", constants.W_OK);
    const space = statfsSync("/dev/shm");
    if (space.bavail * space.bsize >= 1024 ** 3) return "/dev/shm";
  } catch {
    // Other platforms use the ordinary temporary directory.
  }
  return tmpdir();
}

/** Own a temporary service and its storage, independently of test clients. */
export async function testMongoServer() {
  const dbPath = mkdtempSync(join(storageRoot(), "commons-test-mongo-"));
  let server: MongoMemoryServer;
  try {
    server = await MongoMemoryServer.create({
      instance: {
        ip: "127.0.0.1",
        dbPath,
        args: ["--wiredTigerCacheSizeGB", "0.25"],
      },
    });
  } catch (error) {
    rmSync(dbPath, { recursive: true, force: true });
    throw error;
  }
  return {
    server,
    async stop() {
      const mongod = server.instanceInfo?.instance.mongodProcess;
      const kill = setTimeout(() => mongod?.kill("SIGKILL"), 1_000);
      try {
        await server.stop();
      } finally {
        clearTimeout(kill);
        rmSync(dbPath, { recursive: true, force: true });
      }
    },
  };
}

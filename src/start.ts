import { runCommonsProcess } from "./assembly/process.ts";

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const sourcePort = process.env.PORT ?? "4000";
const port = Number(sourcePort);

try {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`commons: PORT must be an integer from 1 to 65535; received "${sourcePort}"`);
  }
  const running = await runCommonsProcess({
    port,
    ...(process.env.MONGODB_URL === undefined ? {} : { mongodbUrl: process.env.MONGODB_URL }),
  });
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await running.stop();
    } catch {
      console.error("commons: shutdown failed.");
      process.exitCode = 1;
    }
  };
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
} catch (error) {
  console.error(messageOf(error));
  process.exitCode = 1;
}
